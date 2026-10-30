create or replace function galactic_private.lineup(p_room uuid,p_member uuid) returns jsonb language plpgsql stable set search_path='' as $$
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
create or replace function galactic_private.make_match(p_match uuid,p_start timestamptz)returns void language plpgsql set search_path='' as $$
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
