create or replace function galactic_private.lineup_base(p_room uuid,p_member uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare d galactic_private.datasets%rowtype;m galactic_private.members%rowtype;result jsonb;
begin
 select * into m from galactic_private.members where id=p_member and room_id=p_room;
 if m is null then return '[]';end if;
 select ds.* into d from galactic_private.datasets ds join galactic_private.rooms r on r.dataset_version=ds.version where r.id=p_room;
 select coalesce(jsonb_agg(player||jsonb_build_object('slot',pk.slot_id,'role',slot->>'role','x',slot->'x','y',slot->'y','fit',galactic_private.fit(player->'positions',slot->>'role',d.config),'effective',round((player->>'overall')::numeric*galactic_private.fit(player->'positions',slot->>'role',d.config)))order by ord),'[]')into result
 from galactic_private.picks pk cross join jsonb_array_elements(d.players)player cross join jsonb_array_elements(d.config#>array['formations',m.formation,'slots'])with ordinality ss(slot,ord)
 where pk.room_id=p_room and pk.member_id=p_member and player->>'id'=pk.player_id and slot->>'id'=pk.slot_id;
 return result;
end;$$;
create or replace function galactic_private.lineup(p_room uuid,p_member uuid)returns jsonb language sql stable set search_path='' as $$select galactic_private.lineup_base(p_room,p_member)$$;
create or replace function galactic_private.strength(p_room uuid,p_member uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare p jsonb;players jsonb:=galactic_private.lineup(p_room,p_member);conf jsonb;tactic text;f numeric;dw numeric;mw numeric;aw numeric;ds numeric:=0;ms numeric:=0;ats numeric:=0;dc numeric:=0;mc numeric:=0;ac numeric:=0;gk numeric:=0;total numeric:=0;stamina numeric:=0;
begin
 select m.tactic,d.config into tactic,conf from galactic_private.members m join galactic_private.rooms r on r.id=m.room_id join galactic_private.datasets d on d.version=r.dataset_version where m.id=p_member and m.room_id=p_room;
 for p in select value from jsonb_array_elements(players)loop
  f:=(p->>'fit')::numeric;total:=total+(p->>'effective')::numeric;stamina:=stamina+(p->>'stamina')::numeric;
  if p->>'role'='GK'then gk:=(p->>'goalkeeping')::numeric*f;continue;end if;
  dw:=case p->>'role'when 'CB'then 1 when 'LB'then .8 when 'RB'then .8 when 'DM'then .6 when 'CM'then .2 else .05 end;
  mw:=case p->>'role'when 'DM'then 1.1 when 'CM'then 1 when 'AM'then .9 when 'LW'then .4 when 'RW'then .4 when 'LB'then .2 when 'RB'then .2 else .1 end;
  aw:=case p->>'role'when 'ST'then 1 when 'LW'then .8 when 'RW'then .8 when 'AM'then .65 when 'CM'then .3 else .1 end;
  ds:=ds+dw*f*((p->>'defending')::numeric*.6+(p->>'physical')::numeric*.25+(p->>'pace')::numeric*.15);dc:=dc+dw;
  ms:=ms+mw*f*((p->>'passing')::numeric*.5+(p->>'dribbling')::numeric*.35+(p->>'physical')::numeric*.15);mc:=mc+mw;
  ats:=ats+aw*f*((p->>'shooting')::numeric*.5+(p->>'dribbling')::numeric*.25+(p->>'pace')::numeric*.25);ac:=ac+aw;
 end loop;
 return jsonb_build_object('overall',round(total/11),'goalkeeping',round(gk),'defence',round(ds/greatest(dc,1)*least(1.08,greatest(.92,power(dc/3.6,.15)))*(conf#>>array['tactics',tactic,'defence'])::numeric),'midfield',round(ms/greatest(mc,1)*least(1.08,greatest(.92,power(mc/3.4,.15)))*(conf#>>array['tactics',tactic,'midfield'])::numeric),'attack',round(ats/greatest(ac,1)*least(1.08,greatest(.92,power(ac/3.2,.15)))*(conf#>>array['tactics',tactic,'attack'])::numeric),'stamina',round(stamina/11),'fatigue',(conf#>array['tactics',tactic,'fatigue']),'tactic',tactic);
end;$$;
create or replace function galactic_private.actor(players jsonb,seed text,n int,shooters boolean default true)returns jsonb language sql immutable set search_path='' as $$
 select p from jsonb_array_elements(players)with ordinality q(p,i) order by case when shooters and p->>'role'='GK'then 2 when shooters and p->>'role'not in('ST','LW','RW','AM')then 1 else 0 end,galactic_private.random_value(seed,n+i::int) limit 1
$$;
create or replace function galactic_private.make_match_v1(p_match uuid,p_start timestamptz)returns void language plpgsql set search_path='' as $$
declare m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;h jsonb;a jsonb;hl jsonb;al jsonb;raw jsonb:='[]';v_timeline jsonb:='[]';e jsonb;actor jsonb;keeper jsonb;seed text;idx int:=0;i int;minute int;prev_min int:=0;offset_ms bigint:=0;hold int;half boolean:=false;hs int:=0;ascore int:=0;side int;chance double precision;p_home double precision;fat_h double precision;fat_a double precision;kind text;txt text;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;winner uuid;v_penalties jsonb;hshot jsonb;ashot jsonb;scored boolean;forced boolean;hpos numeric;v_extra boolean:=false;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;
 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 h:=galactic_private.strength(r.id,hm.id);a:=galactic_private.strength(r.id,am.id);hl:=galactic_private.lineup(r.id,hm.id);al:=galactic_private.lineup(r.id,am.id);seed:=r.seed||':match:'||m.round||':'||m.slot;
 hpos:=least(.72,greatest(.28,.5+((h->>'midfield')::numeric-(a->>'midfield')::numeric)/150));
 raw:=raw||jsonb_build_array(jsonb_build_object('minute',0,'kind','kickoff','text','بازی «'||hm.team_name||'» و «'||am.team_name||'» آغاز شد.','homeScore',0,'awayScore',0));
 -- Regulation and extra-time chances use the same model. Quality changes the
 -- probabilities, while neutral ground and symmetric rules avoid host advantage.
 for i in 1..24 loop
  if i=19 then
   raw:=raw||jsonb_build_array(jsonb_build_object('minute',90,'kind','full_time','text',case when hs=ascore then 'نود دقیقه با تساوی تمام شد؛ بازی به وقت اضافه می‌رود.'else 'سوت پایان نود دقیقه به صدا درآمد.'end,'homeScore',hs,'awayScore',ascore));
   if hs<>ascore then exit;end if;
   v_extra:=true;
   raw:=raw||jsonb_build_array(jsonb_build_object('minute',90,'kind','extra_start','text','وقت اضافه آغاز شد؛ سی دقیقه برای تعیین برنده.','homeScore',hs,'awayScore',ascore));
  end if;
  minute:=case when i<=18 then floor(i*90.0/19)::int+floor(galactic_private.random_value(seed,i)*2)::int else 90+(i-18)*4 end;
  if not half and minute>=45 then raw:=raw||jsonb_build_array(jsonb_build_object('minute',45,'kind','halftime','text','پایان نیمهٔ اول؛ دو تیم برای نیمهٔ دوم آماده می‌شوند.','homeScore',hs,'awayScore',ascore));half:=true;end if;
  idx:=i*100;
  fat_h:=1-(h->>'fatigue')::double precision*least(minute,120)/90.0*(1.25-(h->>'stamina')::double precision/200);
  fat_a:=1-(a->>'fatigue')::double precision*least(minute,120)/90.0*(1.25-(a->>'stamina')::double precision/200);
  p_home:=least(.78,greatest(.22,.5+((h->>'midfield')::double precision*fat_h-(a->>'midfield')::double precision*fat_a)/150));
  if h->>'tactic'='counter'and p_home<.5 then p_home:=p_home+.05;end if;
  if a->>'tactic'='counter'and p_home>.5 then p_home:=p_home-.05;end if;
  side:=case when galactic_private.random_value(seed,idx+1)<p_home then 0 else 1 end;
  actor:=galactic_private.actor(case when side=0 then hl else al end,seed,idx+10,true);
  keeper:=galactic_private.actor(case when side=0 then al else hl end,seed,idx+20,false);
  if galactic_private.random_value(seed,idx+2)<.71 then
   chance:=least(.48,greatest(.06,.21+(case when side=0 then (h->>'attack')::double precision*fat_h-((a->>'defence')::double precision*.55+(a->>'goalkeeping')::double precision*.45)*fat_a else (a->>'attack')::double precision*fat_a-((h->>'defence')::double precision*.55+(h->>'goalkeeping')::double precision*.45)*fat_h end)/220));
   if galactic_private.random_value(seed,idx+3)<chance then
    kind:='goal';if side=0 then hs:=hs+1;else ascore:=ascore+1;end if;
    txt:=(actor->>'name')||case floor(galactic_private.random_value(seed,idx+4)*4)::int when 0 then ' با یک ضربهٔ دقیق توپ را به تور رساند!'when 1 then ' از فضای پشت دفاع استفاده کرد و گل زد!'when 2 then ' پاس هم‌تیمی‌اش را به گل تبدیل کرد!'else ' در محوطه صاحب توپ شد و دروازه را باز کرد!'end;
   elsif galactic_private.random_value(seed,idx+5)<.55 then kind:='save';txt:=(actor->>'name')||' شوت زد؛ دروازه‌بان با واکنش به‌موقع توپ را مهار کرد.';
   else kind:='chance';txt:=(actor->>'name')||' فرصت خوبی داشت، اما ضربه‌اش از کنار دروازه گذشت.';end if;
  elsif galactic_private.random_value(seed,idx+6)<.5 then kind:='interception';txt:='پاس به سمت '||(actor->>'name')||' رفت، اما مدافع حریف مسیر توپ را بست.';
  else kind:='corner';txt:='حرکت '||(actor->>'name')||' از کناره با دخالت دفاع به کرنر انجامید.';end if;
  raw:=raw||jsonb_build_array(jsonb_build_object('minute',minute,'kind',kind,'side',side,'text',txt,'homeScore',hs,'awayScore',ascore));
 end loop;
 if v_extra then
  raw:=raw||jsonb_build_array(jsonb_build_object('minute',120,'kind','extra_end','text',case when hs=ascore then 'وقت اضافه هم با تساوی تمام شد؛ نوبت ضربات پنالتی است.'else 'وقت اضافه به پایان رسید.'end,'homeScore',hs,'awayScore',ascore));
 end if;
 -- Extra time can finish with a winner; only a still-level score needs penalties.
 if hs=ascore then
  for i in 1..30 loop
   select p into hshot from jsonb_array_elements(hl)p order by (p->>'shooting')::int desc,p->>'id' offset((i-1)%11)limit 1;
   select p into ashot from jsonb_array_elements(al)p order by (p->>'shooting')::int desc,p->>'id' offset((i-1)%11)limit 1;
   scored:=galactic_private.random_value(seed,3000+i*2)<least(.9,greatest(.5,.74+((hshot->>'shooting')::double precision-(a->>'goalkeeping')::double precision)/500));forced:=scored;
   ht:=ht+1;if scored then hp:=hp+1;end if;
   raw:=raw||jsonb_build_array(jsonb_build_object('minute',120,'kind','penalty','side',0,'text',(hshot->>'name')||case when scored then ' پنالتی را گل کرد.'else ' پنالتی را از دست داد.'end,'homeScore',hs,'awayScore',ascore,'penaltyHome',hp,'penaltyAway',ap));
   if ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht))then exit;end if;
   scored:=case when i=30 then not forced else galactic_private.random_value(seed,3001+i*2)<least(.9,greatest(.5,.74+((ashot->>'shooting')::double precision-(h->>'goalkeeping')::double precision)/500))end;
   ataken:=ataken+1;if scored then ap:=ap+1;end if;
   raw:=raw||jsonb_build_array(jsonb_build_object('minute',120,'kind','penalty','side',1,'text',(ashot->>'name')||case when scored then ' پنالتی را گل کرد.'else ' پنالتی را از دست داد.'end,'homeScore',hs,'awayScore',ascore,'penaltyHome',hp,'penaltyAway',ap));
   if(ht=ataken and ht>=5 and hp<>ap)or(ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht)))then exit;end if;
  end loop;
  winner:=case when hp>ap then hm.id else am.id end;v_penalties:=jsonb_build_object('home',hp,'away',ap);
 else winner:=case when hs>ascore then hm.id else am.id end;end if;
 raw:=raw||jsonb_build_array(jsonb_build_object('minute',case when v_extra then 120 else 90 end,'kind','final','text','«'||case when winner=hm.id then hm.team_name else am.team_name end||'» برندهٔ مسابقه شد.','homeScore',hs,'awayScore',ascore,'penaltyHome',case when v_penalties is not null then hp end,'penaltyAway',case when v_penalties is not null then ap end));
 for e in select value from jsonb_array_elements(raw)loop
  offset_ms:=offset_ms+greatest(0,(e->>'minute')::int-prev_min)*2000;hold:=case e->>'kind'when 'halftime'then 8000 when 'penalty'then 4000 when 'kickoff'then 4000 when 'final'then 5000 else 6000 end;
  v_timeline:=v_timeline||jsonb_build_array(e||jsonb_build_object('atMs',offset_ms,'untilMs',offset_ms+hold));offset_ms:=offset_ms+hold;prev_min:=(e->>'minute')::int;
 end loop;
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+offset_ms*interval '1 millisecond',timeline=v_timeline,home_score=hs,away_score=ascore,winner_id=winner,penalties=v_penalties,stats=jsonb_build_object('home',h,'away',a,'homePossession',round(hpos*100),'awayPossession',100-round(hpos*100))where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;

-- Version two uses role matchups, connection rules and evolving match state.
create or replace function galactic_private.chemistry(p jsonb,team jsonb,cfg jsonb)returns jsonb language plpgsql immutable set search_path='' as $$
declare q jsonb;pair jsonb;points numeric:=70;delta numeric;nearby boolean;links jsonb:='[]';kind text;label text;level text;
begin
 for q in select value from jsonb_array_elements(team)loop
  if q->>'id'=p->>'id'then continue;end if;
  nearby:=power((q->>'x')::numeric-(p->>'x')::numeric,2)+power((q->>'y')::numeric-(p->>'y')::numeric,2)<=1225;
  delta:=0;kind:=null;label:=null;
  if p->>'club'=q->>'club'then delta:=coalesce((cfg#>>'{chemistry,sameClub}')::numeric,0);kind:='club';label:='هم‌باشگاهی';
  elsif exists(select 1 from jsonb_array_elements(coalesce(cfg#>'{chemistry,rivals}','[]'))v where v?(p->>'club')and v?(q->>'club'))then delta:=coalesce((cfg#>>'{chemistry,rivalClub}')::numeric,0);kind:='rival';label:='رقابت باشگاهی؛ قاعدهٔ بازی';end if;
  if not nearby then delta:=delta*.2;end if;
  for pair in select value from jsonb_array_elements(coalesce(cfg#>'{chemistry,specialPairs}','[]'))loop
   if pair->'players'?(p->>'id')and pair->'players'?(q->>'id')then delta:=-((pair->>'penalty')::numeric);kind:='special';label:=pair->>'label';end if;
  end loop;
  points:=points+delta;
  if delta<>0 then links:=links||jsonb_build_array(jsonb_build_object('player',q->>'id','name',q->>'name','kind',kind,'label',label));end if;
 end loop;
 points:=least(100,greatest(20,points));level:=case when points>=82 then 'green'when points>=65 then 'blue'when points>=45 then 'yellow'else 'red'end;
 return jsonb_build_object('level',level,'score',points,'factor',least(1.06,greatest(.88,1+(points-70)/250)),'links',links);
end;$$;
create or replace function galactic_private.lineup(p_room uuid,p_member uuid)returns jsonb language plpgsql stable set search_path='' as $$
declare raw jsonb;cfg jsonb;result jsonb;
begin
 raw:=galactic_private.lineup_base(p_room,p_member);
 select d.config into cfg from galactic_private.rooms r join galactic_private.datasets d on d.version=r.dataset_version where r.id=p_room;
 select coalesce(jsonb_agg(p||jsonb_build_object('chemistry',galactic_private.chemistry(p,raw,cfg))),'[]')into result from jsonb_array_elements(raw)p;
 return result;
end;$$;
create or replace function galactic_private.public_player(p jsonb)returns jsonb language sql immutable set search_path='' as $$
 select (p-array['overall','pace','shooting','passing','dribbling','defending','physical','stamina','goalkeeping','goalkeeperSkills','heading','jumping','crossing','longShots','composure','freeKicks','penalties','discipline','effective'])||case when p?'chemistry'then jsonb_build_object('chemistry',(p->'chemistry')-array['score','factor'])else '{}'::jsonb end
$$;
create or replace function galactic_private.public_lineup(p_room uuid,p_member uuid)returns jsonb language sql stable set search_path='' as $$select coalesce(jsonb_agg(galactic_private.public_player(p)),'[]')from jsonb_array_elements(galactic_private.lineup(p_room,p_member))p$$;
create or replace function galactic_private.skill(p jsonb,k text,fallback numeric default 60)returns numeric language sql immutable set search_path='' as $$select coalesce((p->>k)::numeric,fallback)$$;
create or replace function galactic_private.aerial(p jsonb)returns numeric language sql immutable set search_path='' as $$select galactic_private.skill(p,'heading',55)*.55+galactic_private.skill(p,'jumping',55)*.25+case when p?'heightCm'then least(99,greatest(15,((p->>'heightCm')::numeric-155)*2))else 55 end*.2$$;
create or replace function galactic_private.profile(team jsonb,cfg jsonb,tactic text,sent_off jsonb,minute int)returns jsonb language plpgsql immutable set search_path='' as $$
declare p jsonb;f numeric;fat numeric;mw numeric;dw numeric;aw numeric;mid numeric:=0;def numeric:=0;att numeric:=0;mc numeric:=0;dc numeric:=0;ac numeric:=0;pa numeric:=0;st numeric:=0;sp numeric:=0;gk numeric:=0;n int:=0;backs int:=0;role text;t jsonb:=cfg#>array['tactics',tactic];
begin
 for p in select value from jsonb_array_elements(team)loop
  if sent_off?(p->>'id')then continue;end if;
  fat:=greatest(.55,1-coalesce((t->>'fatigue')::numeric,.1)*minute/90*(1.3-galactic_private.skill(p,'stamina')/180));
  f:=coalesce((p->>'fit')::numeric,1)*coalesce((p#>>'{chemistry,factor}')::numeric,1)*fat;role:=p->>'role';
  if role='GK'then gk:=galactic_private.skill(p,'goalkeeping')*f;continue;end if;
  n:=n+1;if role in('CB','LB','RB')then backs:=backs+1;end if;
  dw:=case role when 'CB'then 1 when 'LB'then .75 when 'RB'then .75 when 'DM'then .6 when 'CM'then .2 else .04 end;
  mw:=case role when 'CM'then 1 when 'DM'then 1 when 'AM'then .85 when 'LW'then .35 when 'RW'then .35 when 'LB'then .2 when 'RB'then .2 else .08 end;
  aw:=case role when 'ST'then 1 when 'LW'then .8 when 'RW'then .8 when 'AM'then .65 when 'CM'then .25 else .07 end;
  def:=def+dw*f*(galactic_private.skill(p,'defending')*.65+galactic_private.skill(p,'physical')*.25+galactic_private.skill(p,'pace')*.1);dc:=dc+dw;
  mid:=mid+mw*f*(galactic_private.skill(p,'passing')*.55+galactic_private.skill(p,'dribbling')*.3+galactic_private.skill(p,'physical')*.15);mc:=mc+mw;
  att:=att+aw*f*(galactic_private.skill(p,'shooting')*.55+galactic_private.skill(p,'dribbling')*.25+galactic_private.skill(p,'pace')*.2);ac:=ac+aw;
  pa:=pa+galactic_private.skill(p,'passing')*f;sp:=sp+galactic_private.skill(p,'pace')*f;st:=st+galactic_private.skill(p,'stamina');
 end loop;
 if gk=0 then select coalesce(max(galactic_private.skill(q,'goalkeeping')*.4),5)into gk from jsonb_array_elements(team)q where not sent_off?(q->>'id');end if;
 return jsonb_build_object('defence',def/greatest(dc,1)*least(1.18,greatest(.7,power(dc/3.5,.35)))*coalesce((t->>'defence')::numeric,1)*n/10.0,'midfield',mid/greatest(mc,1)*least(1.18,greatest(.7,power(mc/3.2,.35)))*coalesce((t->>'midfield')::numeric,1)*n/10.0,'attack',att/greatest(ac,1)*least(1.18,greatest(.7,power(ac/2.8,.35)))*coalesce((t->>'attack')::numeric,1)*n/10.0,'passing',pa/greatest(n,1),'speed',sp/greatest(n,1),'goalkeeping',gk,'backs',backs,'players',n,'stamina',st/greatest(n,1));
end;$$;
create or replace function galactic_private.choose_actor(team jsonb,job text,seed text,n int,sent_off jsonb)returns jsonb language sql immutable set search_path='' as $$
 select p from jsonb_array_elements(team)with ordinality q(p,i)where not sent_off?(p->>'id')order by
 case job when 'keeper'then case when p->>'role'='GK'then 0 else 1 end when 'defender'then case when p->>'role'in('CB','DM','LB','RB')then 0 else 1 end when 'cross'then case when p->>'role'in('LW','RW','LB','RB')then 0 else 1 end when 'creator'then case when p->>'role'in('CM','AM','DM')then 0 else 1 end when 'long'then case when p->>'role'in('AM','CM','DM','ST')then 0 else 1 end else case when p->>'role'='ST'then 0 when p->>'role'in('LW','RW','AM')then .25 else 1 end end,
 galactic_private.random_value(seed,n+i::int)limit 1
$$;
create or replace function galactic_private.empty_stats()returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('home',v,'away',v)from(select jsonb_build_object('possession',50,'shots',0,'onTarget',0,'passes',0,'passesCompleted',0,'corners',0,'fouls',0,'yellowCards',0,'redCards',0,'offsides',0,'penalties',0)as v)s$$;
create or replace function galactic_private.stat_add(s jsonb,side int,k text,n int default 1)returns jsonb language sql immutable set search_path='' as $$select jsonb_set(s,array[case when side=0 then 'home'else 'away'end,k],to_jsonb(coalesce((s#>>array[case when side=0 then 'home'else 'away'end,k])::int,0)+n))$$;
create or replace function galactic_private.scene(minute int,kind text,txt text,side int,hs int,ascore int,stats jsonb,rh jsonb,ra jsonb)returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('minute',minute,'kind',kind,'text',txt,'side',side,'homeScore',hs,'awayScore',ascore,'stats',stats,'sentOffHome',rh,'sentOffAway',ra)$$;
create or replace function galactic_private.make_match(p_match uuid,p_start timestamptz)returns void language plpgsql set search_path='' as $$
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;def_fit numeric;progress boolean;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;half boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
 if coalesce((cfg->>'engineVersion')::int,1)<2 then perform galactic_private.make_match_v1(p_match,p_start);return;end if;
 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 hl:=galactic_private.lineup(r.id,hm.id);al:=galactic_private.lineup(r.id,am.id);seed:=r.seed||':v2:'||m.round||':'||m.slot;
 raw:=raw||jsonb_build_array(galactic_private.scene(0,'kickoff','بازی «'||hm.team_name||'» با پیراهن آبی و «'||am.team_name||'» با پیراهن قرمز آغاز شد.',null,hs,aws,stats,rh,ra));
 for i in 1..24 loop
  if i=19 then
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'full_time',case when hs=aws then 'سوت پایان نود دقیقه؛ بازی مساوی است و به وقت اضافه می‌رود.'else 'سوت پایان نود دقیقه به صدا درآمد.'end,null,hs,aws,stats,rh,ra));
   if hs<>aws then exit;end if;extra:=true;
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'extra_start','وقت اضافه آغاز می‌شود؛ خستگی حالا اهمیت بیشتری دارد.',null,hs,aws,stats,rh,ra));
  end if;
  minute:=case when i<=18 then floor(i*90.0/19)::int else 90+(i-18)*4 end;idx:=i*100;
  if not half and minute>=45 then raw:=raw||jsonb_build_array(galactic_private.scene(45,'halftime','پایان نیمهٔ اول؛ دو تیم برای نیمهٔ دوم آماده می‌شوند.',null,hs,aws,stats,rh,ra));half:=true;end if;
  h:=galactic_private.profile(hl,cfg,hm.tactic,rh,minute);a:=galactic_private.profile(al,cfg,am.tactic,ra,minute);
  share:=least(.78,greatest(.22,.5+((h->>'midfield')::numeric-(a->>'midfield')::numeric)/180));
  delta:=minute-last_play;hcontrol:=hcontrol+delta*share;total_control:=total_control+delta;pos_h:=round(100*hcontrol/greatest(total_control,1));
  stats:=jsonb_set(jsonb_set(stats,'{home,possession}',to_jsonb(pos_h)),'{away,possession}',to_jsonb(100-pos_h));
  for j in 0..1 loop
   tactic:=case when j=0 then hm.tactic else am.tactic end;opp_tactic:=case when j=0 then am.tactic else hm.tactic end;
   attempts:=greatest(0,round(delta*9*(case when j=0 then share else 1-share end)*case tactic when 'possession'then 1.15 when 'direct'then .8 when 'low_block'then .8 else 1 end));
   pass_chance:=least(.95,greatest(.5,.62+(case when j=0 then(h->>'passing')::numeric else(a->>'passing')::numeric end)/350-case when opp_tactic='press'then .07 else 0 end-case when tactic='direct'then .1 else 0 end));
   complete:=least(attempts,greatest(0,round(attempts*(pass_chance+(galactic_private.random_value(seed,idx+70+j)-.5)*.05))));
   stats:=galactic_private.stat_add(galactic_private.stat_add(stats,j,'passes',attempts),j,'passesCompleted',complete);
   stats:=galactic_private.stat_add(stats,j,'fouls',floor(galactic_private.random_value(seed,idx+74+j)*2)::int);
  end loop;last_play:=minute;
  -- A counterattack can create danger without requiring possession superiority.
  chance:=share;if hm.tactic='counter'and share<.5 then chance:=chance+.06;end if;if am.tactic='counter'and share>.5 then chance:=chance-.06;end if;
  side:=case when galactic_private.random_value(seed,idx+1)<chance then 0 else 1 end;
  if side=0 then attackers:=hl;defenders:=al;ar:=rh;dr:=ra;tactic:=hm.tactic;opp_tactic:=am.tactic;team_name:=hm.team_name;attack_power:=(h->>'attack')::numeric;def_power:=(a->>'defence')::numeric;keeper_skill:=(a->>'goalkeeping')::numeric;else attackers:=al;defenders:=hl;ar:=ra;dr:=rh;tactic:=am.tactic;opp_tactic:=hm.tactic;team_name:=am.team_name;attack_power:=(a->>'attack')::numeric;def_power:=(h->>'defence')::numeric;keeper_skill:=(h->>'goalkeeping')::numeric;end if;
  path:=case tactic when 'wide'then 'cross'when 'central'then 'central'when 'long_shots'then 'long'when 'counter'then 'through'when 'direct'then 'direct'when 'possession'then 'central'else(array['cross','central','through','long'])[1+floor(galactic_private.random_value(seed,idx+2)*4)::int]end;
  creator:=galactic_private.choose_actor(attackers,case when path='cross'then 'cross'else 'creator'end,seed,idx+10,ar);
  shooter:=galactic_private.choose_actor(attackers,case when path='long'then 'long'else 'shooter'end,seed,idx+20,ar);
  defender:=galactic_private.choose_actor(defenders,'defender',seed,idx+30,dr);
  wing:=case when creator->>'role'in('RW','RB')then 'راست'else 'چپ'end;target_name:=shooter->>'name';
  txt:=case path when 'cross'then '«'||team_name||'» از سمت '||wing||' پیش می‌آید؛ فضای خطرناکی کنار محوطه باز شده است.'when 'long'then '«'||team_name||'» پشت محوطه توپ را می‌چرخاند؛ شاید فرصت شوت از دور فراهم شود.'when 'through'then '«'||team_name||'» توپ را پس گرفته؛ پشت دفاع حریف فضای خالی دیده می‌شود.'when 'direct'then '«'||team_name||'» بازی را سریع به جلو می‌برد؛ یک پاس بلند به سمت خط حمله.'else '«'||team_name||'» به مرکز دفاع نزدیک می‌شود؛ چند پاس کوتاه و حرکت بین خطوط.'end;
  seq:=jsonb_build_array(galactic_private.scene(minute,'build_up',txt,side,hs,aws,stats,rh,ra));
  if galactic_private.random_value(seed,idx+3)<.19 then
   -- The foul, referee decision, kick and outcome are separate reveals.
   fouler:=defender;stats:=galactic_private.stat_add(stats,1-side,'fouls');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'foul',(fouler->>'name')||' برای متوقف کردن حرکت وارد می‌شود؛ بازیکن روی زمین است و داور سوت می‌زند.',side,hs,aws,stats,rh,ra));
   second_yellow:=coalesce((yellows->>(fouler->>'id'))::int,0)>0;
   red:=galactic_private.random_value(seed,idx+4)<.055;yellow:=not red and galactic_private.random_value(seed,idx+5)<(.48+case when opp_tactic='press'then .13 else 0 end+(75-galactic_private.skill(fouler,'discipline',70))/250);
   if yellow then stats:=galactic_private.stat_add(stats,1-side,'yellowCards');yellows:=jsonb_set(yellows,array[fouler->>'id'],to_jsonb(coalesce((yellows->>(fouler->>'id'))::int,0)+1));end if;
   if yellow and second_yellow then red:=true;end if;
   if red then
    stats:=galactic_private.stat_add(stats,1-side,'redCards');if side=0 then ra:=ra||jsonb_build_array(fouler->>'id');dr:=ra;else rh:=rh||jsonb_build_array(fouler->>'id');dr:=rh;end if;
    txt:=(fouler->>'name')||case when yellow then ' کارت زرد دوم را می‌گیرد؛ اخراج! تیمش از این لحظه یک نفر کمتر دارد.'else ' کارت قرمز مستقیم می‌گیرد؛ تیمش از این لحظه یک نفر کمتر دارد.'end;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'red_card',txt,side,hs,aws,stats,rh,ra));
   elsif yellow then seq:=seq||jsonb_build_array(galactic_private.scene(minute,'yellow_card',(fouler->>'name')||' با کارت زرد داور روبه‌رو می‌شود.',side,hs,aws,stats,rh,ra));end if;
   path:=case when galactic_private.random_value(seed,idx+6)<.28 then 'penalty_kick'else 'free_kick'end;
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by galactic_private.skill(p,case when path='penalty_kick'then 'penalties'else 'freeKicks'end)desc,p->>'id'limit 1;
   target_name:=shooter->>'name';
   if path='penalty_kick'then stats:=galactic_private.stat_add(stats,side,'penalties');txt:='داور به نقطهٔ پنالتی اشاره می‌کند؛ '||target_name||' پشت توپ قرار می‌گیرد.';
   else txt:='ضربهٔ آزاد در موقعیتی مناسب؛ '||target_name||' توپ را تنظیم می‌کند و به دروازه نگاه می‌کند.';end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,path,txt,side,hs,aws,stats,rh,ra));progress:=true;
  elsif galactic_private.random_value(seed,idx+7)<.07 and path in('through','direct')then
   stats:=galactic_private.stat_add(stats,side,'offsides');seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' پشت مدافعان حرکت می‌کند؛ پاس رو به جلو ارسال می‌شود.',side,hs,aws,stats,rh,ra));seq:=seq||jsonb_build_array(galactic_private.scene(minute,'offside','پرچم کمک‌داور بالا رفته است؛ حرکت آفساید بود.',side,hs,aws,stats,rh,ra));progress:=false;
  else
   actor_fit:=coalesce((creator->>'fit')::numeric,1)*coalesce((creator#>>'{chemistry,factor}')::numeric,1);def_fit:=coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
   chance:=least(.96,greatest(.32,.78+(galactic_private.skill(creator,case when path='cross'then 'crossing'else 'passing'end)*actor_fit-galactic_private.skill(defender,'defending')*def_fit)/250));
   if path='long'then chance:=.95;end if;if path='through'then chance:=chance+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/400;end if;
   if opp_tactic='low_block'and path='central'then chance:=chance-.12;end if;
   progress:=galactic_private.random_value(seed,idx+8)<chance;
   txt:=case path when 'cross'then (creator->>'name')||' از کناره عبور می‌کند و توپ را به محوطه می‌فرستد؛ '||target_name||' برای ضربهٔ سر آماده می‌شود.'when 'long'then target_name||' پشت محوطه صاحب توپ می‌شود، سرش را بالا می‌آورد و برای شوت آماده می‌شود.'when 'through'then (creator->>'name')||' توپ را به فضای پشت دفاع می‌فرستد؛ '||target_name||' با سرعت به سمت توپ می‌رود.'when 'direct'then target_name||' با مدافع برای توپ بلند درگیر می‌شود و تلاش می‌کند آن را کنترل کند.'else (creator->>'name')||' پاس رو به جلو را می‌فرستد؛ '||target_name||' بین مدافعان برای کنترل توپ حرکت می‌کند.'end;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'action',txt,side,hs,aws,stats,rh,ra));
   if not progress then
    kind:='interception';txt:=(defender->>'name')||' زودتر به توپ می‌رسد و حمله را قطع می‌کند.';
    if path='cross'and galactic_private.random_value(seed,idx+9)<.45 then kind:='corner';stats:=galactic_private.stat_add(stats,side,'corners');txt:=(defender->>'name')||' ارسال را دفع می‌کند؛ توپ به کرنر می‌رود.';end if;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
   end if;
  end if;
  if progress then
   actor_fit:=coalesce((shooter->>'fit')::numeric,1)*coalesce((shooter#>>'{chemistry,factor}')::numeric,1);
   actor_fit:=actor_fit*greatest(.55,1-(cfg#>>array['tactics',tactic,'fatigue'])::numeric*minute/90*(1.3-galactic_private.skill(shooter,'stamina')/180));
   on_prob:=.55+(galactic_private.skill(shooter,'shooting')*actor_fit-70)/350;goal_prob:=.29+(attack_power-def_power)/330+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/240;
   if path='cross'then
    aerial_diff:=galactic_private.aerial(shooter)*actor_fit-galactic_private.aerial(defender)*coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
    on_prob:=.54+aerial_diff/220;goal_prob:=.31+aerial_diff/145+(galactic_private.skill(creator,'crossing')-75)/400+(attack_power-def_power)/500+(75-keeper_skill)/300;
   elsif path='long'then on_prob:=.38+(galactic_private.skill(shooter,'longShots')*actor_fit-70)/300;goal_prob:=.16+(galactic_private.skill(shooter,'longShots')*actor_fit-keeper_skill)/250;
   elsif path='through'then goal_prob:=goal_prob+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/350;
   elsif path='direct'then on_prob:=on_prob+(galactic_private.skill(shooter,'physical')-galactic_private.skill(defender,'physical'))/400;
   elsif path='free_kick'then on_prob:=.4+(galactic_private.skill(shooter,'freeKicks')-70)/300;goal_prob:=.23+(galactic_private.skill(shooter,'freeKicks')-keeper_skill)/280;
   elsif path='penalty_kick'then on_prob:=.91;goal_prob:=.82+(galactic_private.skill(shooter,'penalties')*actor_fit-keeper_skill)/300;end if;
   on_prob:=least(.94,greatest(.15,on_prob));goal_prob:=least(.9,greatest(.05,goal_prob));
   on_target:=galactic_private.random_value(seed,idx+50)<on_prob;goal:=on_target and galactic_private.random_value(seed,idx+51)<goal_prob;
   stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   if goal then kind:='goal';if side=0 then hs:=hs+1;else aws:=aws+1;end if;txt:=case path when 'cross'then target_name||' با ضربهٔ سر می‌زند... گل! توپ درون دروازه است!'when 'penalty_kick'then target_name||' به توپ ضربه می‌زند... گل! پنالتی تبدیل به گل شد.'when 'free_kick'then target_name||' از روی دیوار دفاعی می‌زند... گل! ضربهٔ آزاد به تور می‌رسد.'when 'long'then target_name||' از راه دور شوت می‌زند... گل! یک ضربهٔ تماشایی!'else target_name||' ضربه را می‌زند... گل! توپ به تور دروازه می‌رسد!'end;
   elsif on_target then kind:='save';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... دروازه‌بان توپ را مهار می‌کند!'else ' ضربه می‌زند... دروازه‌بان با واکنش به‌موقع مانع گل می‌شود!'end;
   elsif galactic_private.random_value(seed,idx+52)<.23 then kind:='woodwork';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... اوه! توپ به تیر دروازه می‌خورد و برمی‌گردد!'else ' شوت می‌زند... اوه! توپ به تیر دروازه برخورد می‌کند!'end;
   else kind:='miss';txt:=target_name||case when path='penalty_kick'then ' به توپ ضربه می‌زند... پنالتی بیرون می‌رود! چه فرصتی از دست رفت.'when path='cross'then ' برای ضربهٔ سر بلند می‌شود... توپ از بالای دروازه عبور می‌کند.'else ' ضربه می‌زند... توپ از کنار دروازه می‌گذرد.'end;end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
  end if;
  seq_hold:=16000/jsonb_array_length(seq);
  for e in select value from jsonb_array_elements(seq)loop raw:=raw||jsonb_build_array(e||jsonb_build_object('holdMs',seq_hold,'sequence',i));end loop;
 end loop;
 if extra then raw:=raw||jsonb_build_array(galactic_private.scene(120,'extra_end',case when hs=aws then 'وقت اضافه هم با تساوی تمام شد؛ پنالتی‌ها برنده را تعیین می‌کنند.'else 'پایان وقت اضافه.'end,null,hs,aws,stats,rh,ra));end if;
 if hs=aws then
  for i in 1..30 loop
   for side in 0..1 loop
    attackers:=case when side=0 then hl else al end;ar:=case when side=0 then rh else ra end;
    select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by galactic_private.skill(p,'penalties')desc,p->>'id'offset((i-1)%(11-jsonb_array_length(ar)))limit 1;
    keeper_skill:=case when side=0 then(a->>'goalkeeping')::numeric else(h->>'goalkeeping')::numeric end;
    goal:=galactic_private.random_value(seed,4000+i*2+side)<least(.92,greatest(.45,.76+(galactic_private.skill(shooter,'penalties')-keeper_skill)/400));
    if i=30 and side=1 then goal:=(hp=ap);end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_setup',(shooter->>'name')||' برای پنالتی پشت توپ قرار می‌گیرد؛ نگاه‌ها به دروازه است.',side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',2500));
    if side=0 then ht:=ht+1;if goal then hp:=hp+1;end if;else ataken:=ataken+1;if goal then ap:=ap+1;end if;end if;
    raw:=raw||jsonb_build_array(galactic_private.scene(120,'shootout_kick',(shooter->>'name')||case when goal then ' ضربه می‌زند... گل!'else ' ضربه می‌زند... پنالتی از دست می‌رود!'end,side,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',hp,'penaltyAway',ap,'holdMs',3500));
    if ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht))then exit;end if;
   end loop;
   if(ht=ataken and ht>=5 and hp<>ap)or(ht<=5 and ataken<=5 and(hp>ap+greatest(0,5-ataken)or ap>hp+greatest(0,5-ht)))then exit;end if;
  end loop;winner:=case when hp>ap then hm.id else am.id end;penalties:=jsonb_build_object('home',hp,'away',ap);
 else winner:=case when hs>aws then hm.id else am.id end;end if;
 raw:=raw||jsonb_build_array(galactic_private.scene(case when extra then 120 else 90 end,'final','«'||case when winner=hm.id then hm.team_name else am.team_name end||'» برندهٔ مسابقه شد.',null,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',case when penalties is not null then hp end,'penaltyAway',case when penalties is not null then ap end));
 for e in select value from jsonb_array_elements(raw)loop
  off_ms:=off_ms+greatest(0,(e->>'minute')::int-prev_min)*2000;hold:=coalesce((e->>'holdMs')::int,case when e->>'kind'='halftime'then 8000 else 5000 end);
  timeline:=timeline||jsonb_build_array((e-'holdMs')||jsonb_build_object('atMs',off_ms,'untilMs',off_ms+hold));off_ms:=off_ms+hold;prev_min:=(e->>'minute')::int;
 end loop;
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',2)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;
