-- Additive v4 competition, saved draft offers and match-local halftime state.
alter table galactic_private.rooms add column if not exists competition text not null default 'cup' check(competition in('cup','league'));
alter table galactic_private.rooms add column if not exists selection text not null default 'normal' check(selection in('normal','draft'));
alter table galactic_private.members add column if not exists rerolls jsonb not null default '{}';
alter table galactic_private.members add column if not exists roles jsonb not null default '{}';
alter table galactic_private.matches add column if not exists home_setup jsonb;
alter table galactic_private.matches add column if not exists away_setup jsonb;
alter table galactic_private.matches add column if not exists initial_home jsonb;
alter table galactic_private.matches add column if not exists initial_away jsonb;
alter table galactic_private.matches add column if not exists halftime_at timestamptz;
alter table galactic_private.matches add column if not exists halftime_until timestamptz;
alter table galactic_private.matches add column if not exists stage text;
alter table galactic_private.matches add column if not exists sim_state jsonb;
create table if not exists galactic_private.offers(room_id uuid not null references galactic_private.rooms(id)on delete cascade,member_id uuid not null references galactic_private.members(id)on delete cascade,context text not null,slot text not null,players jsonb not null,rerolled boolean not null default false,primary key(room_id,member_id,context,slot));
create table if not exists galactic_private.reserves(room_id uuid not null references galactic_private.rooms(id)on delete cascade,round int not null,match_id uuid not null references galactic_private.matches(id)on delete cascade,member_id uuid not null references galactic_private.members(id)on delete cascade,player_id text not null,primary key(room_id,round,player_id));
create index if not exists galactic_offers_member_idx on galactic_private.offers(member_id);
create index if not exists galactic_reserves_match_member_idx on galactic_private.reserves(match_id,member_id);
create index if not exists galactic_reserves_member_idx on galactic_private.reserves(member_id);
alter table galactic_private.offers enable row level security;
alter table galactic_private.reserves enable row level security;
revoke all on galactic_private.offers,galactic_private.reserves from public,anon,authenticated;
create or replace function galactic_private.create_bracket_v3(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;n int;size int:=2;ord int[]:=array[0,1];next_order int[];seed_no int;round_no int:=1;slots int;idx int;ids uuid[];previous_ids uuid[];new_ids uuid[];hid uuid;aid uuid;mid uuid;status text;
begin
 select * into r from galactic_private.rooms where id=p_room;n:=jsonb_array_length(r.draft_order);
 select array_agg(m.id order by galactic_private.random_value(r.seed||':bracket:'||m.id,1))into ids from galactic_private.members m where m.room_id=p_room;
 while size<n loop size:=size*2;next_order:='{}';foreach seed_no in array ord loop next_order:=next_order||array[seed_no,size-1-seed_no];end loop;ord:=next_order;end loop;
 slots:=size/2;previous_ids:='{}';
 for idx in 1..slots loop
  hid:=ids[ord[idx*2-1]+1];aid:=ids[ord[idx*2]+1];mid:=gen_random_uuid();status:=case when hid is null or aid is null then 'bye'else 'ready'end;
  insert into galactic_private.matches(id,room_id,round,slot,home_id,away_id,status,winner_id)values(mid,p_room,1,idx,hid,aid,status,case when status='bye'then coalesce(hid,aid)end);previous_ids:=array_append(previous_ids,mid);
 end loop;
 while slots>1 loop round_no:=round_no+1;slots:=slots/2;new_ids:='{}';for idx in 1..slots loop mid:=gen_random_uuid();insert into galactic_private.matches(id,room_id,round,slot,source_home,source_away)values(mid,p_room,round_no,idx,previous_ids[idx*2-1],previous_ids[idx*2]);new_ids:=array_append(new_ids,mid);end loop;previous_ids:=new_ids;end loop;
 update galactic_private.rooms set phase='tournament',pick_deadline=null,next_match_at=p_at+interval '10 seconds'where id=p_room;
end;$$;
create or replace function galactic_private.auto_pick_v3(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;d galactic_private.datasets%rowtype;who uuid;formation text;player_id text;slot_id text;
begin
 select * into r from galactic_private.rooms where id=p_room;select * into d from galactic_private.datasets where version=r.dataset_version;who:=galactic_private.turn_member(r);
 select m.formation into formation from galactic_private.members m where m.id=who;
 select p->>'id',s->>'id'into player_id,slot_id from jsonb_array_elements(d.players)p cross join jsonb_array_elements(d.config#>array['formations',formation,'slots'])s
 where not exists(select 1 from galactic_private.picks pk where pk.room_id=p_room and pk.player_id=p->>'id')and not exists(select 1 from galactic_private.picks pk where pk.room_id=p_room and pk.member_id=who and pk.slot_id=s->>'id')
 order by case when s->>'role'='GK'and galactic_private.fit(p->'positions','GK',d.config)=1 then 0 else 1 end,((p->>'overall')::numeric*galactic_private.fit(p->'positions',s->>'role',d.config))desc,p->>'id',s->>'id'limit 1;
 if player_id is null then raise exception 'بازیکن کافی برای تکمیل تیم وجود ندارد.';end if;
 perform galactic_private.do_pick(p_room,who,player_id,slot_id,true,p_at);
end;$$;
create or replace function galactic_private.advance_v3(p_room uuid,p_now timestamptz)returns boolean language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;m galactic_private.matches%rowtype;w galactic_private.matches%rowtype;s1 galactic_private.matches%rowtype;s2 galactic_private.matches%rowtype;changed boolean:=false;iteration int;v_round int;v_start timestamptz;v_engine int;
begin
 select coalesce((d.config->>'engineVersion')::int,1)into v_engine from galactic_private.rooms rr join galactic_private.datasets d on d.version=rr.dataset_version where rr.id=p_room;
 if v_engine<2 then return galactic_private.advance_v1(p_room,p_now);end if;
 for iteration in 1..128 loop
  select * into r from galactic_private.rooms where id=p_room;
  if r.phase='draft'then
   if r.pick_deadline<=p_now then perform galactic_private.auto_pick(p_room,r.pick_deadline);changed:=true;continue;end if;exit;
  elsif r.phase='tournament'then
   for m in select * from galactic_private.matches where room_id=p_room and status='live'and ends_at<=p_now loop update galactic_private.matches set status='finished'where id=m.id;changed:=true;end loop;
   for w in select * from galactic_private.matches where room_id=p_room and status='waiting'order by round,slot loop
    select * into s1 from galactic_private.matches where id=w.source_home;select * into s2 from galactic_private.matches where id=w.source_away;
    if s1.status in('finished','bye')and s2.status in('finished','bye')then update galactic_private.matches set home_id=s1.winner_id,away_id=s2.winner_id,status=case when s1.winner_id is null or s2.winner_id is null then 'bye'else 'ready'end,winner_id=case when s1.winner_id is null or s2.winner_id is null then coalesce(s1.winner_id,s2.winner_id)end where id=w.id;changed:=true;end if;
   end loop;
   if not exists(select 1 from galactic_private.matches where room_id=p_room and status not in('finished','bye'))then
    select * into m from galactic_private.matches where room_id=p_room order by round desc,slot limit 1;update galactic_private.rooms set phase='finished',winner=m.winner_id,next_match_at=null where id=p_room;changed:=true;exit;
   end if;
   if exists(select 1 from galactic_private.matches where room_id=p_room and status='live')then exit;end if;
   select min(round)into v_round from galactic_private.matches where room_id=p_room and status='ready';
   v_start:=r.next_match_at;
   if v_start is null then select max(ends_at)+interval '10 seconds'into v_start from galactic_private.matches where room_id=p_room and status='finished';update galactic_private.rooms set next_match_at=v_start where id=p_room;changed:=true;end if;
   if v_start<=p_now and v_round is not null then
    for m in select * from galactic_private.matches where room_id=p_room and status='ready'and round=v_round order by slot loop perform galactic_private.make_match(m.id,v_start);end loop;
    changed:=true;continue;
   end if;exit;
  else exit;end if;
 end loop;
 if changed then update galactic_private.rooms set version=version+1,updated_at=p_now where id=p_room;perform galactic_private.notify_room(p_room);end if;return changed;
end;$$;
create or replace function galactic_private.match_view_v3(p_match uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare m galactic_private.matches%rowtype;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;elapsed bigint;events jsonb;last_event jsonb;next_event jsonb;start_ms bigint;playback jsonb;
begin
 select * into m from galactic_private.matches where id=p_match;if m.id is null then return null;end if;
 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 start_ms:=floor(extract(epoch from m.started_at)*1000);elapsed:=greatest(0,floor(extract(epoch from(p_now-m.started_at))*1000));
 select coalesce(jsonb_agg(e order by i),'[]')into events from jsonb_array_elements(m.timeline)with ordinality q(e,i)where (e->>'atMs')::bigint<=elapsed;
 last_event:=events->(jsonb_array_length(events)-1);
 select e into next_event from jsonb_array_elements(m.timeline)with ordinality q(e,i)where (e->>'atMs')::bigint>elapsed order by i limit 1;
 playback:=jsonb_build_object('minute',coalesce((last_event->>'minute')::int,0),'anchorAt',start_ms+coalesce((last_event->>'untilMs')::bigint,0),'pausedUntil',start_ms+coalesce((last_event->>'untilMs')::bigint,0),'nextMinute',coalesce((next_event->>'minute')::int,(last_event->>'minute')::int,0),'minuteMs',2000);
 return jsonb_build_object('id',m.id,'round',m.round,'slot',m.slot,'status',m.status,'startedAt',m.started_at,'endsAt',case when m.status='finished'then m.ends_at end,'home',jsonb_build_object('id',hm.id,'name',hm.name,'teamName',hm.team_name,'formation',hm.formation,'tactic',hm.tactic,'color','blue','players',galactic_private.public_lineup(m.room_id,hm.id)),'away',jsonb_build_object('id',am.id,'name',am.name,'teamName',am.team_name,'formation',am.formation,'tactic',am.tactic,'color','red','players',galactic_private.public_lineup(m.room_id,am.id)),'homeScore',coalesce((last_event->>'homeScore')::int,0),'awayScore',coalesce((last_event->>'awayScore')::int,0),'penalties',case when last_event->>'penaltyHome'is not null then jsonb_build_object('home',last_event->'penaltyHome','away',last_event->'penaltyAway')end,'winner',case when m.status='finished'then m.winner_id end,'events',events,'playback',playback,'stats',coalesce(last_event->'stats',jsonb_build_object('home',jsonb_build_object('possession',m.stats->'homePossession'),'away',jsonb_build_object('possession',m.stats->'awayPossession'))),'sentOffHome',coalesce(last_event->'sentOffHome','[]'),'sentOffAway',coalesce(last_event->'sentOffAway','[]'));
end;$$;
create or replace function galactic_private.room_view_v3(p_room uuid,p_uid uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare r galactic_private.rooms%rowtype;members jsonb;picks jsonb;matches jsonb:='[]';live_views jsonb:='[]';self_id uuid;current_id uuid;round_no int;m galactic_private.matches%rowtype;v jsonb;
begin
 select * into r from galactic_private.rooms where id=p_room;select id into self_id from galactic_private.members where room_id=p_room and user_id=p_uid;
 if self_id is null then raise exception 'عضو این اتاق نیستی.'using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',mm.id,'name',mm.name,'teamName',mm.team_name,'formation',mm.formation,'tactic',mm.tactic,'ready',mm.ready,'host',mm.user_id=r.host_id,'self',mm.user_id=p_uid,'online',mm.last_seen>p_now-interval '20 seconds','players',galactic_private.public_lineup(p_room,mm.id))order by mm.joined_at,mm.id),'[]')into members from galactic_private.members mm where mm.room_id=p_room;
 select coalesce(jsonb_agg(jsonb_build_object('number',pk.number,'member',pk.member_id,'player',pk.player_id,'slot',pk.slot_id,'automatic',pk.automatic,'at',pk.picked_at)order by pk.number),'[]')into picks from galactic_private.picks pk where pk.room_id=p_room;
 select coalesce(min(round)filter(where status='live'),max(round)filter(where status='finished'),min(round)filter(where status='ready'),1)into round_no from galactic_private.matches where room_id=p_room;
 select id into current_id from galactic_private.matches where room_id=p_room and status in('live','finished')order by (home_id=self_id or away_id=self_id)desc,round desc,(status='live')desc,slot limit 1;
 for m in select * from galactic_private.matches where room_id=p_room order by round,slot loop
  v:=null;if m.status in('live','finished')then v:=galactic_private.match_view(m.id,p_now);end if;
  if m.round=round_no and v is not null then live_views:=live_views||jsonb_build_array(v);end if;
  matches:=matches||jsonb_build_array(jsonb_build_object('id',m.id,'round',m.round,'slot',m.slot,'home',m.home_id,'away',m.away_id,'status',m.status,'winner',case when m.status in('finished','bye')then m.winner_id end,'homeScore',v->'homeScore','awayScore',v->'awayScore','penalties',v->'penalties'));
 end loop;
 return jsonb_build_object('id',r.id,'code',r.code,'title',r.title,'public',r.public,'capacity',r.capacity,'phase',r.phase,'version',r.version,'datasetVersion',r.dataset_version,'self',self_id,'host',r.host_id=p_uid,'members',members,'picks',picks,'draftOrder',r.draft_order,'pickNumber',r.pick_number,'turn',case when r.phase='draft'then galactic_private.turn_member(r)end,'pickDeadline',r.pick_deadline,'nextMatchAt',r.next_match_at,'matches',matches,'currentRound',round_no,'liveMatches',live_views,'currentMatch',galactic_private.match_view(current_id,p_now),'winner',r.winner,'serverNow',floor(extract(epoch from p_now)*1000));
end;$$;
create or replace function galactic_private.act_v3(p_code text,p_action jsonb)returns jsonb language plpgsql set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;m galactic_private.members%rowtype;d galactic_private.datasets%rowtype;stamp timestamptz:=clock_timestamp();kind text:=p_action->>'type';f text;t text;v_team_name text;slot text;pid text;who uuid;order_ids jsonb;result jsonb;
begin
 select * into r from galactic_private.rooms where code=upper(trim(p_code))for update;
 if r.id is null then raise exception 'اتاق پیدا نشد.';end if;select * into m from galactic_private.members where room_id=r.id and user_id=u;
 if m.id is null then raise exception 'عضو این اتاق نیستی.'using errcode='42501';end if;
 stamp:=clock_timestamp();perform galactic_private.advance(r.id,stamp);select * into r from galactic_private.rooms where id=r.id;select * into d from galactic_private.datasets where version=r.dataset_version;
 if kind='setup'then
  if r.phase<>'lobby'then raise exception 'چیدمان و تاکتیک قفل شده‌اند.';end if;
  f:=p_action->>'formation';t:=p_action->>'tactic';v_team_name:=trim(p_action->>'teamName');
  if f is null or t is null or not(d.config->'formations')?f or not(d.config->'tactics')?t or v_team_name is null or char_length(v_team_name)not between 2 and 30 or v_team_name~'[<>[:cntrl:]]'then raise exception 'آرایش، تاکتیک و نام تیم را بررسی کن.';end if;
  update galactic_private.members set formation=f,tactic=t,team_name=v_team_name,ready=coalesce((p_action->>'ready')::boolean,false),last_seen=stamp where id=m.id;
 elsif kind='start'then
  if r.host_id<>u or r.phase<>'lobby'then raise exception 'شروع بازی فقط با میزبان است.';end if;
  if(select count(*)from galactic_private.members where room_id=r.id)<2 or exists(select 1 from galactic_private.members where room_id=r.id and not ready)then raise exception 'حداقل دو بازیکن و آمادگی همهٔ تیم‌ها لازم است.';end if;
  select jsonb_agg(mm.id order by galactic_private.random_value(r.seed||':draft:'||mm.id,1))into order_ids from galactic_private.members mm where mm.room_id=r.id;
  update galactic_private.rooms set phase='draft',draft_order=order_ids,pick_deadline=stamp+interval '60 seconds'where id=r.id;
 elsif kind='pick'then
  if r.phase<>'draft'or p_action->>'pickNumber'is null or(p_action->>'pickNumber')::int<>r.pick_number or galactic_private.turn_member(r)<>m.id then return galactic_private.room_view(r.id,u,stamp)||jsonb_build_object('notice','نوبت تغییر کرده است؛ وضعیت تازه را ببین.');end if;
  pid:=p_action->>'player';slot:=p_action->>'slot';
  if not exists(select 1 from jsonb_array_elements(d.players)p where p->>'id'=pid)or not exists(select 1 from jsonb_array_elements(d.config#>array['formations',m.formation,'slots'])s where s->>'id'=slot)then raise exception 'بازیکن یا جایگاه معتبر نیست.';end if;
  if exists(select 1 from galactic_private.picks where room_id=r.id and player_id=pid)or exists(select 1 from galactic_private.picks where room_id=r.id and member_id=m.id and slot_id=slot)then raise exception 'این بازیکن یا جایگاه قبلاً انتخاب شده است.';end if;
  perform galactic_private.do_pick(r.id,m.id,pid,slot,false,stamp);
 elsif kind in('leave','kick')then
  if r.phase<>'lobby'then raise exception 'پس از شروع، تیم حفظ می‌شود و انتخاب‌های غایب خودکارند.';end if;
  who:=case when kind='leave'then m.id else nullif(p_action->>'member','')::uuid end;
  if kind='kick'and(r.host_id<>u or who=m.id)then raise exception 'این کار فقط با میزبان است.';end if;
  delete from galactic_private.members where room_id=r.id and id=who;
  if not exists(select 1 from galactic_private.members where room_id=r.id)then update galactic_private.rooms set phase='cancelled'where id=r.id;
  elsif kind='leave'and r.host_id=u then update galactic_private.rooms set host_id=(select user_id from galactic_private.members where room_id=r.id order by joined_at,id limit 1)where id=r.id;end if;
  if kind='leave'then update galactic_private.rooms set version=version+1 where id=r.id;perform galactic_private.notify_room(r.id);return jsonb_build_object('left',true);end if;
 else raise exception 'درخواست معتبر نیست.';end if;
 update galactic_private.rooms set version=version+1,updated_at=stamp where id=r.id;perform galactic_private.notify_room(r.id);
 return galactic_private.room_view(r.id,u,stamp);
end;$$;
create or replace function galactic_private.make_match_v3(p_match uuid,p_start timestamptz)returns void language plpgsql set search_path='' as $$
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;def_fit numeric;progress boolean;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;half boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;v3 boolean;play_minutes int[];vars jsonb;overturned boolean;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
 v3:=coalesce((cfg->>'engineVersion')::int,1)>=3;
 if coalesce((cfg->>'engineVersion')::int,1)<2 then perform galactic_private.make_match_v1(p_match,p_start);return;end if;
 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 hl:=galactic_private.lineup(r.id,hm.id);al:=galactic_private.lineup(r.id,am.id);seed:=r.seed||':v2:'||m.round||':'||m.slot;
 raw:=raw||jsonb_build_array(galactic_private.scene(0,'kickoff','بازی «'||hm.team_name||'» با پیراهن آبی و «'||am.team_name||'» با پیراهن قرمز آغاز شد.',null,hs,aws,stats,rh,ra));
 -- Independent draws, sorted chronologically: clustered chances, quiet spells and late drama.
 select array_agg(n order by n)into play_minutes from(select 1+floor(galactic_private.random_value(seed,8000+g)*90)::int n from generate_series(1,18)g)q;
 select play_minutes||array_agg(n order by n)into play_minutes from(select 91+floor(galactic_private.random_value(seed,8100+g)*30)::int n from generate_series(1,6)g)q;
 for i in 1..24 loop
  if i=19 then
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'full_time',case when hs=aws then 'سوت پایان نود دقیقه؛ بازی مساوی است و به وقت اضافه می‌رود.'else 'سوت پایان نود دقیقه به صدا درآمد.'end,null,hs,aws,stats,rh,ra));
   if hs<>aws then exit;end if;extra:=true;
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'extra_start','وقت اضافه آغاز می‌شود؛ خستگی حالا اهمیت بیشتری دارد.',null,hs,aws,stats,rh,ra));
  end if;
  minute:=case when v3 then play_minutes[i] when i<=18 then floor(i*90.0/19)::int else 90+(i-18)*4 end;idx:=i*100;
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
  if v3 and galactic_private.random_value(seed,idx+80)<.3 then path:=(array['cross','central','through','long','dribble','cutback'])[1+floor(galactic_private.random_value(seed,idx+81)*6)::int];end if;
  creator:=galactic_private.choose_actor(attackers,case when path='cross'then 'cross'else 'creator'end,seed,idx+10,ar);
  shooter:=galactic_private.choose_actor(attackers,case when path='long'then 'long'else 'shooter'end,seed,idx+20,ar);
  defender:=galactic_private.choose_actor(defenders,'defender',seed,idx+30,dr);
  wing:=case when creator->>'role'in('RW','RB')then 'راست'else 'چپ'end;target_name:=shooter->>'name';
  txt:=case path when 'cross'then '«'||team_name||'» از سمت '||wing||' پیش می‌آید؛ فضای خطرناکی کنار محوطه باز شده است.'when 'long'then '«'||team_name||'» پشت محوطه توپ را می‌چرخاند؛ شاید فرصت شوت از دور فراهم شود.'when 'through'then '«'||team_name||'» توپ را پس گرفته؛ پشت دفاع حریف فضای خالی دیده می‌شود.'when 'direct'then '«'||team_name||'» بازی را سریع به جلو می‌برد؛ یک پاس بلند به سمت خط حمله.'else '«'||team_name||'» به مرکز دفاع نزدیک می‌شود؛ چند پاس کوتاه و حرکت بین خطوط.'end;
  vars:=jsonb_build_object('team',team_name,'creator',creator->>'name','target',target_name,'defender',defender->>'name','wing',wing);
  if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+82,'build_up',path,vars),txt);end if;
  seq:=jsonb_build_array(galactic_private.scene(minute,'build_up',txt,side,hs,aws,stats,rh,ra));
  if v3 and galactic_private.random_value(seed,idx+83)<.09 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' برای رسیدن به پاس عمقی سرعت می‌گیرد؛ دروازه‌بان هم جلو آمده است.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_sweep','پاس پشت دفاع می‌افتد؛ دروازه‌بان از محوطه بیرون می‌آید و پیش از '||target_name||' توپ را دور می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif galactic_private.random_value(seed,idx+3)<.19 then
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
   if path='dribble'then chance:=least(.92,greatest(.25,.65+(galactic_private.skill(shooter,'dribbling')*coalesce((shooter->>'fit')::numeric,1)-galactic_private.skill(defender,'defending')*def_fit)/180));end if;
   if path='cutback'then chance:=chance-.04;end if;
   if path='long'then chance:=.95;end if;if path='through'then chance:=chance+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/400;end if;
   if opp_tactic='low_block'and path='central'then chance:=chance-.12;end if;
   progress:=galactic_private.random_value(seed,idx+8)<chance;
   txt:=case path when 'cross'then (creator->>'name')||' از کناره عبور می‌کند و توپ را به محوطه می‌فرستد؛ '||target_name||' برای ضربهٔ سر آماده می‌شود.'when 'long'then target_name||' پشت محوطه صاحب توپ می‌شود، سرش را بالا می‌آورد و برای شوت آماده می‌شود.'when 'through'then (creator->>'name')||' توپ را به فضای پشت دفاع می‌فرستد؛ '||target_name||' با سرعت به سمت توپ می‌رود.'when 'direct'then target_name||' با مدافع برای توپ بلند درگیر می‌شود و تلاش می‌کند آن را کنترل کند.'else (creator->>'name')||' پاس رو به جلو را می‌فرستد؛ '||target_name||' بین مدافعان برای کنترل توپ حرکت می‌کند.'end;
   if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+84,'action',path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'action',txt,side,hs,aws,stats,rh,ra));
   if not progress then
    kind:='interception';txt:=(defender->>'name')||' زودتر به توپ می‌رسد و حمله را قطع می‌کند.';
    if path='cross'and galactic_private.random_value(seed,idx+9)<.45 then kind:='corner';stats:=galactic_private.stat_add(stats,side,'corners');txt:=(defender->>'name')||' ارسال را دفع می‌کند؛ توپ به کرنر می‌رود.';end if;
    if v3 and kind='interception'then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+85,kind,path,vars),txt);end if;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
    if v3 and kind='corner'and galactic_private.random_value(seed,idx+86)<.65 then
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_setup',(creator->>'name')||' برای زدن کرنر می‌رود؛ مدافعان یارهایشان را زیر نظر دارند.',side,hs,aws,stats,rh,ra));
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery','توپ به داخل محوطه می‌پیچد؛ '||target_name||' برای ضربهٔ سر از میان مدافعان جلو می‌آید.',side,hs,aws,stats,rh,ra));path:='cross';progress:=true;
    end if;
   end if;
  end if;
  if v3 and progress and path='cross'and galactic_private.random_value(seed,idx+87)<.12 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_claim','دروازه‌بان از خط جدا می‌شود و ارسال را بالاتر از سر '||target_name||' می‌گیرد؛ خطر رفع شد.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif v3 and progress and path not in('penalty_kick','free_kick')and galactic_private.random_value(seed,idx+88)<.12 then
   stats:=galactic_private.stat_add(stats,side,'shots');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'blocked_shot',target_name||' ضربه می‌زند؛ '||(defender->>'name')||' خودش را جلوی توپ می‌اندازد و شوت را بلوکه می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
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
   if v3 and on_target and not goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+89)<.17 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'parry',target_name||' می‌زند... دروازه‌بان توپ را برمی‌گرداند اما آن را نگرفته است!',side,hs,aws,stats,rh,ra));
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'rebound',target_name||' برای توپ برگشتی هجوم می‌برد؛ مدافع هم به سمت توپ می‌دود.',side,hs,aws,stats,rh,ra));
    on_target:=galactic_private.random_value(seed,idx+90)<least(.88,greatest(.3,.60+(galactic_private.skill(shooter,'composure')*actor_fit-70)/250));
    goal:=on_target and galactic_private.random_value(seed,idx+91)<least(.8,greatest(.1,.42+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/250));
    stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   end if;
   overturned:=false;
   if v3 and goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+92)<.14 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'var_review','توپ از دروازه‌بان عبور می‌کند؛ کمک‌داور هنوز تأیید نکرده و صحنه در حال بررسی است...',side,hs,aws,stats,rh,ra));
    overturned:=galactic_private.random_value(seed,idx+93)<.35;
    if overturned then goal:=false;stats:=galactic_private.stat_add(galactic_private.stat_add(galactic_private.stat_add(stats,side,'offsides'),side,'shots',-1),side,'onTarget',-1);end if;
   end if;
   if overturned then kind:='disallowed_goal';txt:='تصمیم نهایی: آفساید! گلِ '||target_name||' پذیرفته نشد؛ امتیاز تغییری نمی‌کند.';
   elsif goal then kind:='goal';if side=0 then hs:=hs+1;else aws:=aws+1;end if;txt:=case path when 'cross'then target_name||' با ضربهٔ سر می‌زند... گل! توپ درون دروازه است!'when 'penalty_kick'then target_name||' به توپ ضربه می‌زند... گل! پنالتی تبدیل به گل شد.'when 'free_kick'then target_name||' از روی دیوار دفاعی می‌زند... گل! ضربهٔ آزاد به تور می‌رسد.'when 'long'then target_name||' از راه دور شوت می‌زند... گل! یک ضربهٔ تماشایی!'else target_name||' ضربه را می‌زند... گل! توپ به تور دروازه می‌رسد!'end;
   elsif on_target then kind:='save';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... دروازه‌بان توپ را مهار می‌کند!'else ' ضربه می‌زند... دروازه‌بان با واکنش به‌موقع مانع گل می‌شود!'end;
   elsif galactic_private.random_value(seed,idx+52)<.23 then kind:='woodwork';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... اوه! توپ به تیر دروازه می‌خورد و برمی‌گردد!'else ' شوت می‌زند... اوه! توپ به تیر دروازه برخورد می‌کند!'end;
   else kind:='miss';txt:=target_name||case when path='penalty_kick'then ' به توپ ضربه می‌زند... پنالتی بیرون می‌رود! چه فرصتی از دست رفت.'when path='cross'then ' برای ضربهٔ سر بلند می‌شود... توپ از بالای دروازه عبور می‌کند.'else ' ضربه می‌زند... توپ از کنار دروازه می‌گذرد.'end;end if;
   if v3 and path not in('penalty_kick','free_kick')then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+94,kind,path,vars),txt);end if;
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
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',case when v3 then 3 else 2 end)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;
create or replace function galactic_private.profile_v4(team jsonb,cfg jsonb,tactic text,sent_off jsonb,minute int)returns jsonb language plpgsql immutable set search_path='' as $$
declare p jsonb;f numeric;fat numeric;mw numeric;dw numeric;aw numeric;mid numeric:=0;def numeric:=0;att numeric:=0;mc numeric:=0;dc numeric:=0;ac numeric:=0;pa numeric:=0;st numeric:=0;sp numeric:=0;gk numeric:=0;n int:=0;backs int:=0;role text;t jsonb:=cfg#>array['tactics',tactic];
begin
 for p in select value from jsonb_array_elements(team)loop
  if sent_off?(p->>'id')then continue;end if;
  fat:=greatest(.55,1-coalesce((t->>'fatigue')::numeric,.1)*greatest(0,minute-coalesce((p->>'joinedMinute')::int,0))/90*(1.3-galactic_private.skill(p,'stamina')/180));
  f:=coalesce((p->>'fit')::numeric,1)*coalesce((p#>>'{chemistry,factor}')::numeric,1)*fat;role:=p->>'role';if coalesce((p->>'captain')::boolean,false)then f:=f*1.025;end if;
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

create or replace function galactic_private.actor_v4(team jsonb,job text,seed text,n int,sent_off jsonb)returns jsonb language sql immutable set search_path='' as $$
 select p from jsonb_array_elements(team)with ordinality q(p,i)where not sent_off?(p->>'id')and(case when job='keeper'then true else p->>'role'<>'GK'end)
 order by -ln(greatest(.0000001,galactic_private.random_value(seed,n+i::int)))/
 (case job when 'keeper'then case when p->>'role'='GK'then 100 else .01 end
 when 'defender'then case when p->>'role'='CB'then 6 when p->>'role'in('LB','RB','DM')then 3 else .1 end
 when 'cross'then case when p->>'role'in('LW','RW')then 6 when p->>'role'in('LB','RB')then 3 when p->>'role'='CM'then 1 else .1 end
 when 'creator'then case when p->>'role'in('CM','AM')then 5 when p->>'role'in('LW','RW','DM')then 3 when p->>'role'in('LB','RB')then 1.5 else .4 end
 when 'corner'then case when p->>'role'in('CB','ST')then 5 when p->>'role'in('DM','CM')then 2 else .5 end
 when 'long'then case when p->>'role'in('AM','CM')then 5 when p->>'role'in('LW','RW','ST')then 3 when p->>'role'='DM'then 2 else .3 end
 else case when p->>'role'='ST'then 7 when p->>'role'in('LW','RW')then 4 when p->>'role'='AM'then 3 when p->>'role'='CM'then 1.5 when p->>'role'in('LB','RB','DM')then .6 else .2 end end) limit 1
$$;
create or replace function galactic_private.decorate(players jsonb,cfg jsonb,roles jsonb)returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(p||jsonb_build_object('chemistry',galactic_private.chemistry(p,players,cfg),'captain',p->>'id'=roles->>'captain')),'[]')from jsonb_array_elements(players)p
$$;
create or replace function galactic_private.member_setup(rid uuid,mid uuid)returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('formation',m.formation,'tactic',m.tactic,'roles',m.roles,'players',galactic_private.decorate(galactic_private.lineup(rid,mid),d.config,m.roles))from galactic_private.members m join galactic_private.rooms r on r.id=m.room_id join galactic_private.datasets d on d.version=r.dataset_version where m.id=mid and r.id=rid
$$;
create or replace function galactic_private.public_setup(s jsonb)returns jsonb language sql stable set search_path='' as $$select s||jsonb_build_object('players',(select coalesce(jsonb_agg(galactic_private.public_player(p)-'joinedMinute'),'[]')from jsonb_array_elements(s->'players')p))$$;
create or replace function galactic_private.simulate_v4(p_match uuid,p_start timestamptz,p_second boolean)returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
<<simulation>>
declare
 m galactic_private.matches%rowtype;r galactic_private.rooms%rowtype;cfg jsonb;hm galactic_private.members%rowtype;am galactic_private.members%rowtype;hl jsonb;al jsonb;h jsonb;a jsonb;attackers jsonb;defenders jsonb;ar jsonb;dr jsonb;rh jsonb:='[]';ra jsonb:='[]';yellows jsonb:='{}';
 raw jsonb:='[]';seq jsonb;timeline jsonb:='[]';e jsonb;creator jsonb;shooter jsonb;defender jsonb;fouler jsonb;seed text;i int;j int;idx int;minute int;last_play int:=0;prev_min int:=0;hs int:=0;aws int:=0;hp int:=0;ap int:=0;ht int:=0;ataken int:=0;side int;path text;tactic text;opp_tactic text;wing text;kind text;txt text;team_name text;target_name text;chance numeric;on_prob numeric;goal_prob numeric;share numeric;hcontrol numeric:=0;total_control numeric:=0;delta int;attempts int;complete int;pass_chance numeric;pos_h int;actor_fit numeric;def_fit numeric;progress boolean;on_target boolean;goal boolean;red boolean;yellow boolean;second_yellow boolean;extra boolean:=false;half boolean:=false;stats jsonb:=galactic_private.empty_stats();keeper_skill numeric;attack_power numeric;def_power numeric;aerial_diff numeric;winner uuid;penalties jsonb;off_ms bigint:=0;hold int;seq_hold int;v3 boolean;play_minutes int[];vars jsonb;overturned boolean;home_state jsonb;away_state jsonb;role_pid text;corner_play boolean;
begin
 select * into m from galactic_private.matches where id=p_match;select * into r from galactic_private.rooms where id=m.room_id;select config into cfg from galactic_private.datasets where version=r.dataset_version;
 if coalesce((cfg->>'engineVersion')::int,1)>=5 then perform galactic_private.simulate_v5(p_match,p_start,p_second);return;end if;
 v3:=coalesce((cfg->>'engineVersion')::int,1)>=3;

 select * into hm from galactic_private.members where id=m.home_id;select * into am from galactic_private.members where id=m.away_id;
 home_state:=m.home_setup;away_state:=m.away_setup;
 hm.formation:=home_state->>'formation';hm.tactic:=home_state->>'tactic';am.formation:=away_state->>'formation';am.tactic:=away_state->>'tactic';
 hl:=home_state->'players';al:=away_state->'players';seed:=r.seed||':v4:'||m.round||':'||m.slot;
 if p_second then
  stats:=m.sim_state->'stats';hs:=(m.sim_state->>'hs')::int;aws:=(m.sim_state->>'aws')::int;rh:=m.sim_state->'rh';ra:=m.sim_state->'ra';yellows:=m.sim_state->'yellows';
  hcontrol:=(m.sim_state->>'hcontrol')::numeric;total_control:=(m.sim_state->>'total_control')::numeric;last_play:=45;prev_min:=45;half:=true;timeline:=m.timeline;off_ms:=floor(extract(epoch from(m.halftime_until-m.started_at))*1000);
 else

 raw:=raw||jsonb_build_array(galactic_private.scene(0,'kickoff','بازی «'||hm.team_name||'» با پیراهن آبی و «'||am.team_name||'» با پیراهن قرمز آغاز شد.',null,hs,aws,stats,rh,ra));
 end if;
 if p_second then raw:=jsonb_build_array(galactic_private.scene(45,'second_half','نیمهٔ دوم آغاز شد؛ تیم‌ها با تصمیم‌های تازه به زمین برگشته‌اند.',null,hs,aws,stats,rh,ra));end if;
 -- Independent draws, sorted chronologically: clustered chances, quiet spells and late drama.
 select array_agg(n order by n)into play_minutes from(select 1+floor(galactic_private.random_value(seed,8000+g)*45)::int n from generate_series(1,9)g)q;
 select play_minutes||array_agg(n order by n)into play_minutes from(select 46+floor(galactic_private.random_value(seed,8000+g)*45)::int n from generate_series(10,18)g)q;
 select play_minutes||array_agg(n order by n)into play_minutes from(select 91+floor(galactic_private.random_value(seed,8100+g)*30)::int n from generate_series(1,6)g)q;
 for i in (case when p_second then 10 else 1 end)..(case when p_second then 24 else 9 end) loop
  if i=19 then
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'full_time',case when hs=aws and r.competition='league'then 'نود دقیقه با تساوی تمام شد؛ هر تیم یک امتیاز می‌گیرد.'when hs=aws then 'سوت پایان نود دقیقه؛ بازی مساوی است و به وقت اضافه می‌رود.'else 'سوت پایان نود دقیقه به صدا درآمد.'end,null,hs,aws,stats,rh,ra));
   if hs<>aws or r.competition='league' then exit;end if;extra:=true;
   raw:=raw||jsonb_build_array(galactic_private.scene(90,'extra_start','وقت اضافه آغاز می‌شود؛ خستگی حالا اهمیت بیشتری دارد.',null,hs,aws,stats,rh,ra));
  end if;
  minute:=case when v3 then play_minutes[i] when i<=18 then floor(i*90.0/19)::int else 90+(i-18)*4 end;idx:=i*100;
  if not half and minute>=45 then raw:=raw||jsonb_build_array(galactic_private.scene(45,'halftime','پایان نیمهٔ اول؛ دو تیم برای نیمهٔ دوم آماده می‌شوند.',null,hs,aws,stats,rh,ra));half:=true;end if;
  h:=galactic_private.profile_v4(hl,cfg,hm.tactic,rh,minute);a:=galactic_private.profile_v4(al,cfg,am.tactic,ra,minute);
  share:=least(.78,greatest(.22,.5+((h->>'midfield')::numeric-(a->>'midfield')::numeric)/180+case hm.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end-case am.tactic when 'possession'then .08 when 'low_block'then -.08 else 0 end));
  delta:=minute-last_play;hcontrol:=hcontrol+delta*share;total_control:=total_control+delta;pos_h:=round(100*hcontrol/greatest(total_control,1));
  stats:=jsonb_set(jsonb_set(stats,'{home,possession}',to_jsonb(pos_h)),'{away,possession}',to_jsonb(100-pos_h));
  for j in 0..1 loop
   tactic:=case when j=0 then hm.tactic else am.tactic end;opp_tactic:=case when j=0 then am.tactic else hm.tactic end;
   attempts:=greatest(0,round(delta*9*(case when j=0 then share else 1-share end)*case tactic when 'possession'then 1.15 when 'direct'then .8 when 'low_block'then .8 else 1 end));
   pass_chance:=least(.95,greatest(.5,.62+(case when j=0 then(h->>'passing')::numeric else(a->>'passing')::numeric end)/350-case when opp_tactic='press'then .07 else 0 end-case when tactic='direct'then .1 else 0 end));
   complete:=least(attempts,greatest(0,round(attempts*(pass_chance+(galactic_private.random_value(seed,idx+70+j)-.5)*.05))));
   stats:=galactic_private.stat_add(galactic_private.stat_add(stats,j,'passes',attempts),j,'passesCompleted',complete);
   -- Every counted foul has a narrated whistle; there are no invisible card/foul events.
  end loop;last_play:=minute;
  -- A counterattack can create danger without requiring possession superiority.
  chance:=share;if hm.tactic='counter'and share<.5 then chance:=chance+.06;end if;if am.tactic='counter'and share>.5 then chance:=chance-.06;end if;
  side:=case when galactic_private.random_value(seed,idx+1)<chance then 0 else 1 end;
  if side=0 then attackers:=hl;defenders:=al;ar:=rh;dr:=ra;tactic:=hm.tactic;opp_tactic:=am.tactic;team_name:=hm.team_name;attack_power:=(h->>'attack')::numeric;def_power:=(a->>'defence')::numeric;keeper_skill:=(a->>'goalkeeping')::numeric;else attackers:=al;defenders:=hl;ar:=ra;dr:=rh;tactic:=am.tactic;opp_tactic:=hm.tactic;team_name:=am.team_name;attack_power:=(a->>'attack')::numeric;def_power:=(h->>'defence')::numeric;keeper_skill:=(h->>'goalkeeping')::numeric;end if;
  path:=case tactic when 'wide'then case when galactic_private.random_value(seed,idx+95)<.65 then 'cross'else 'cutback'end when 'central'then 'central'when 'long_shots'then 'long'when 'counter'then 'through'when 'direct'then 'direct'when 'possession'then 'central'else(array['cross','central','through','long'])[1+floor(galactic_private.random_value(seed,idx+2)*4)::int]end;
  if v3 and galactic_private.random_value(seed,idx+80)<.3 then path:=(array['cross','central','through','long','dribble','cutback'])[1+floor(galactic_private.random_value(seed,idx+81)*6)::int];end if;
  creator:=galactic_private.actor_v4(attackers,case when path='cross'then 'cross'else 'creator'end,seed,idx+10,ar);
  corner_play:=false;
  shooter:=galactic_private.actor_v4(attackers,case when path='long'then 'long'else 'shooter'end,seed,idx+20,ar);
  if shooter->>'id'=creator->>'id'and path not in('long','dribble')then shooter:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>creator->>'id'),'shooter',seed,idx+21,ar);end if;
  defender:=galactic_private.actor_v4(defenders,'defender',seed,idx+30,dr);
  if galactic_private.random_value(seed,idx+96)<(case when tactic='wide'then .34 else .23 end)then
   corner_play:=true;path:='cross';shooter:=galactic_private.actor_v4(attackers,'corner',seed,idx+97,ar);
   if shooter->>'id'=creator->>'id'then creator:=galactic_private.actor_v4((select jsonb_agg(p)from jsonb_array_elements(attackers)p where p->>'id'<>shooter->>'id'),'creator',seed,idx+98,ar);end if;
  end if;
  wing:=case when creator->>'role'in('RW','RB')then 'راست'else 'چپ'end;target_name:=shooter->>'name';
  txt:=case path when 'cross'then '«'||team_name||'» از سمت '||wing||' پیش می‌آید؛ فضای خطرناکی کنار محوطه باز شده است.'when 'long'then '«'||team_name||'» پشت محوطه توپ را می‌چرخاند؛ شاید فرصت شوت از دور فراهم شود.'when 'through'then '«'||team_name||'» توپ را پس گرفته؛ پشت دفاع حریف فضای خالی دیده می‌شود.'when 'direct'then '«'||team_name||'» بازی را سریع به جلو می‌برد؛ یک پاس بلند به سمت خط حمله.'else '«'||team_name||'» به مرکز دفاع نزدیک می‌شود؛ چند پاس کوتاه و حرکت بین خطوط.'end;
  vars:=jsonb_build_object('team',team_name,'creator',creator->>'name','target',target_name,'defender',defender->>'name','wing',wing);
  if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+82,'build_up',path,vars),txt);end if;
  seq:=jsonb_build_array(galactic_private.scene(minute,'build_up',txt,side,hs,aws,stats,rh,ra));
  if corner_play then
   stats:=galactic_private.stat_add(stats,side,'corners');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_won',(defender->>'name')||' توپ را از خط عرضی بیرون می‌زند؛ کرنر برای «'||team_name||'».',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_setup',target_name||' برای کمک به حمله از جایگاه '||(shooter->>'role')||' جلو آمده؛ '||(creator->>'name')||' پشت توپ می‌ایستد.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery',(creator->>'name')||' کرنر را ارسال می‌کند؛ '||target_name||' برای ضربهٔ سر با مدافع رقابت می‌کند.',side,hs,aws,stats,rh,ra));progress:=true;
  elsif v3 and galactic_private.random_value(seed,idx+83)<.09 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' برای رسیدن به پاس عمقی سرعت می‌گیرد؛ دروازه‌بان هم جلو آمده است.',side,hs,aws,stats,rh,ra));
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_sweep','پاس پشت دفاع می‌افتد؛ دروازه‌بان از محوطه بیرون می‌آید و پیش از '||target_name||' توپ را دور می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif galactic_private.random_value(seed,idx+3)<.19 then
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
   role_pid:=case when side=0 then home_state else away_state end#>>array['roles',case when path='penalty_kick'then 'penalty'else 'freeKick'end];
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,case when path='penalty_kick'then 'penalties'else 'freeKicks'end)desc,p->>'id'limit 1;
   target_name:=shooter->>'name';
   if path='penalty_kick'then stats:=galactic_private.stat_add(stats,side,'penalties');txt:='داور به نقطهٔ پنالتی اشاره می‌کند؛ '||target_name||' پشت توپ قرار می‌گیرد.';
   else txt:='ضربهٔ آزاد در موقعیتی مناسب؛ '||target_name||' توپ را تنظیم می‌کند و به دروازه نگاه می‌کند.';end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,path,txt,side,hs,aws,stats,rh,ra));progress:=true;
  elsif galactic_private.random_value(seed,idx+7)<.07 and path in('through','direct')then
   stats:=galactic_private.stat_add(stats,side,'offsides');seq:=seq||jsonb_build_array(galactic_private.scene(minute,'movement',target_name||' پشت مدافعان حرکت می‌کند؛ پاس رو به جلو ارسال می‌شود.',side,hs,aws,stats,rh,ra));seq:=seq||jsonb_build_array(galactic_private.scene(minute,'offside','پرچم کمک‌داور بالا رفته است؛ حرکت آفساید بود.',side,hs,aws,stats,rh,ra));progress:=false;
  else
   actor_fit:=coalesce((creator->>'fit')::numeric,1)*coalesce((creator#>>'{chemistry,factor}')::numeric,1);def_fit:=coalesce((defender->>'fit')::numeric,1)*coalesce((defender#>>'{chemistry,factor}')::numeric,1);
   chance:=least(.96,greatest(.32,.78+(galactic_private.skill(creator,case when path='cross'then 'crossing'else 'passing'end)*actor_fit-galactic_private.skill(defender,'defending')*def_fit)/250));
   if path='dribble'then chance:=least(.92,greatest(.25,.65+(galactic_private.skill(shooter,'dribbling')*coalesce((shooter->>'fit')::numeric,1)-galactic_private.skill(defender,'defending')*def_fit)/180));end if;
   if path='cutback'then chance:=chance-.04;end if;
   if path='long'then chance:=.95;end if;if path='through'then chance:=chance+(galactic_private.skill(shooter,'pace')-galactic_private.skill(defender,'pace'))/400;end if;
   if opp_tactic='low_block'and path='central'then chance:=chance-.12;end if;
   progress:=galactic_private.random_value(seed,idx+8)<chance;
   txt:=case path when 'cross'then (creator->>'name')||' از کناره عبور می‌کند و توپ را به محوطه می‌فرستد؛ '||target_name||' برای ضربهٔ سر آماده می‌شود.'when 'long'then target_name||' پشت محوطه صاحب توپ می‌شود، سرش را بالا می‌آورد و برای شوت آماده می‌شود.'when 'through'then (creator->>'name')||' توپ را به فضای پشت دفاع می‌فرستد؛ '||target_name||' با سرعت به سمت توپ می‌رود.'when 'direct'then target_name||' با مدافع برای توپ بلند درگیر می‌شود و تلاش می‌کند آن را کنترل کند.'else (creator->>'name')||' پاس رو به جلو را می‌فرستد؛ '||target_name||' بین مدافعان برای کنترل توپ حرکت می‌کند.'end;
   if v3 then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+84,'action',path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'action',txt,side,hs,aws,stats,rh,ra));
   if not progress then
    kind:='interception';txt:=(defender->>'name')||' زودتر به توپ می‌رسد و حمله را قطع می‌کند.';
    if path='cross'and galactic_private.random_value(seed,idx+9)<.45 then kind:='corner';stats:=galactic_private.stat_add(stats,side,'corners');txt:=(defender->>'name')||' ارسال را دفع می‌کند؛ توپ به کرنر می‌رود.';end if;
    if v3 and kind='interception'then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+85,kind,path,vars),txt);end if;
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
    if v3 and kind='corner'and galactic_private.random_value(seed,idx+86)<.65 then
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_setup',(creator->>'name')||' برای زدن کرنر می‌رود؛ مدافعان یارهایشان را زیر نظر دارند.',side,hs,aws,stats,rh,ra));
     seq:=seq||jsonb_build_array(galactic_private.scene(minute,'corner_delivery','توپ به داخل محوطه می‌پیچد؛ '||target_name||' برای ضربهٔ سر از میان مدافعان جلو می‌آید.',side,hs,aws,stats,rh,ra));path:='cross';progress:=true;
    end if;
   end if;
  end if;
  if v3 and progress and path='cross'and galactic_private.random_value(seed,idx+87)<.12 then
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'keeper_claim','دروازه‌بان از خط جدا می‌شود و ارسال را بالاتر از سر '||target_name||' می‌گیرد؛ خطر رفع شد.',side,hs,aws,stats,rh,ra));progress:=false;
  elsif v3 and progress and path not in('penalty_kick','free_kick')and galactic_private.random_value(seed,idx+88)<.12 then
   stats:=galactic_private.stat_add(stats,side,'shots');
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,'blocked_shot',target_name||' ضربه می‌زند؛ '||(defender->>'name')||' خودش را جلوی توپ می‌اندازد و شوت را بلوکه می‌کند.',side,hs,aws,stats,rh,ra));progress:=false;
  end if;
  if progress then
   actor_fit:=coalesce((shooter->>'fit')::numeric,1)*coalesce((shooter#>>'{chemistry,factor}')::numeric,1);
   actor_fit:=actor_fit*greatest(.55,1-(cfg#>>array['tactics',tactic,'fatigue'])::numeric*greatest(0,minute-coalesce((shooter->>'joinedMinute')::int,0))/90*(1.3-galactic_private.skill(shooter,'stamina')/180));
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
   if v3 and on_target and not goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+89)<.17 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'parry',target_name||' می‌زند... دروازه‌بان توپ را برمی‌گرداند اما آن را نگرفته است!',side,hs,aws,stats,rh,ra));
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'rebound',target_name||' برای توپ برگشتی هجوم می‌برد؛ مدافع هم به سمت توپ می‌دود.',side,hs,aws,stats,rh,ra));
    on_target:=galactic_private.random_value(seed,idx+90)<least(.88,greatest(.3,.60+(galactic_private.skill(shooter,'composure')*actor_fit-70)/250));
    goal:=on_target and galactic_private.random_value(seed,idx+91)<least(.8,greatest(.1,.42+(galactic_private.skill(shooter,'shooting')*actor_fit-keeper_skill)/250));
    stats:=galactic_private.stat_add(stats,side,'shots');if on_target then stats:=galactic_private.stat_add(stats,side,'onTarget');end if;
   end if;
   overturned:=false;
   if v3 and goal and path<>'penalty_kick'and galactic_private.random_value(seed,idx+92)<.14 then
    seq:=seq||jsonb_build_array(galactic_private.scene(minute,'var_review','توپ از دروازه‌بان عبور می‌کند؛ کمک‌داور هنوز تأیید نکرده و صحنه در حال بررسی است...',side,hs,aws,stats,rh,ra));
    overturned:=galactic_private.random_value(seed,idx+93)<.35;
    if overturned then goal:=false;stats:=galactic_private.stat_add(galactic_private.stat_add(galactic_private.stat_add(stats,side,'offsides'),side,'shots',-1),side,'onTarget',-1);end if;
   end if;
   if overturned then kind:='disallowed_goal';txt:='تصمیم نهایی: آفساید! گلِ '||target_name||' پذیرفته نشد؛ امتیاز تغییری نمی‌کند.';
   elsif goal then kind:='goal';if side=0 then hs:=hs+1;else aws:=aws+1;end if;txt:=case path when 'cross'then target_name||' با ضربهٔ سر می‌زند... گل! توپ درون دروازه است!'when 'penalty_kick'then target_name||' به توپ ضربه می‌زند... گل! پنالتی تبدیل به گل شد.'when 'free_kick'then target_name||' از روی دیوار دفاعی می‌زند... گل! ضربهٔ آزاد به تور می‌رسد.'when 'long'then target_name||' از راه دور شوت می‌زند... گل! یک ضربهٔ تماشایی!'else target_name||' ضربه را می‌زند... گل! توپ به تور دروازه می‌رسد!'end;
   elsif on_target then kind:='save';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... دروازه‌بان توپ را مهار می‌کند!'else ' ضربه می‌زند... دروازه‌بان با واکنش به‌موقع مانع گل می‌شود!'end;
   elsif galactic_private.random_value(seed,idx+52)<.23 then kind:='woodwork';txt:=target_name||case when path='cross'then ' با ضربهٔ سر می‌زند... اوه! توپ به تیر دروازه می‌خورد و برمی‌گردد!'else ' شوت می‌زند... اوه! توپ به تیر دروازه برخورد می‌کند!'end;
   else kind:='miss';txt:=target_name||case when path='penalty_kick'then ' به توپ ضربه می‌زند... پنالتی بیرون می‌رود! چه فرصتی از دست رفت.'when path='cross'then ' برای ضربهٔ سر بلند می‌شود... توپ از بالای دروازه عبور می‌کند.'else ' ضربه می‌زند... توپ از کنار دروازه می‌گذرد.'end;end if;
   if v3 and path not in('penalty_kick','free_kick')then txt:=coalesce(galactic_private.commentary(cfg,seed,idx+94,kind,path,vars),txt);end if;
   seq:=seq||jsonb_build_array(galactic_private.scene(minute,kind,txt,side,hs,aws,stats,rh,ra));
  end if;
  seq_hold:=16000/jsonb_array_length(seq);
  for e in select value from jsonb_array_elements(seq)loop raw:=raw||jsonb_build_array(e||jsonb_build_object('holdMs',seq_hold,'sequence',i));end loop;
 end loop;
 if p_second then
 if extra then raw:=raw||jsonb_build_array(galactic_private.scene(120,'extra_end',case when hs=aws then 'وقت اضافه هم با تساوی تمام شد؛ پنالتی‌ها برنده را تعیین می‌کنند.'else 'پایان وقت اضافه.'end,null,hs,aws,stats,rh,ra));end if;
 if hs=aws and r.competition='cup' then
  for i in 1..30 loop
   for side in 0..1 loop
    attackers:=case when side=0 then hl else al end;ar:=case when side=0 then rh else ra end;
    role_pid:=(case when side=0 then home_state else away_state end)#>>'{roles,penalty}';
   select p into shooter from jsonb_array_elements(attackers)p where not ar?(p->>'id')order by (p->>'id'=coalesce(role_pid,''))desc, galactic_private.skill(p,'penalties')desc,p->>'id'offset((i-1)%(11-jsonb_array_length(ar)))limit 1;
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
 else winner:=case when hs>aws then hm.id when aws>hs then am.id end;end if;
 raw:=raw||jsonb_build_array(galactic_private.scene(case when extra then 120 else 90 end,'final',case when winner is null then 'مسابقه با تساوی تمام شد؛ هر تیم یک امتیاز می‌گیرد.'else '«'||case when winner=hm.id then hm.team_name else am.team_name end||'» برندهٔ مسابقه شد.'end,null,hs,aws,stats,rh,ra)||jsonb_build_object('penaltyHome',case when penalties is not null then hp end,'penaltyAway',case when penalties is not null then ap end));
 else
 raw:=raw||jsonb_build_array(galactic_private.scene(45,'halftime','پایان نیمهٔ اول؛ دو دقیقه برای تغییر آرایش، تاکتیک و حداکثر پنج تعویض.',null,hs,aws,stats,rh,ra)||jsonb_build_object('holdMs',120000));
 end if;
 for e in select value from jsonb_array_elements(raw)loop
  off_ms:=off_ms+greatest(0,(e->>'minute')::int-prev_min)*2000;hold:=coalesce((e->>'holdMs')::int,case when e->>'kind'='halftime'then 8000 else 5000 end);
  timeline:=timeline||jsonb_build_array((e-'holdMs')||jsonb_build_object('atMs',off_ms,'untilMs',off_ms+hold));off_ms:=off_ms+hold;prev_min:=(e->>'minute')::int;
 end loop;
 if not p_second then
  update galactic_private.matches set halftime_at=p_start+(off_ms-120000)*interval '1 millisecond',halftime_until=p_start+off_ms*interval '1 millisecond',stage='first',sim_state=jsonb_build_object('stats',stats,'hs',hs,'aws',aws,'rh',rh,'ra',ra,'yellows',yellows,'hcontrol',hcontrol,'total_control',total_control)where id=p_match;
 else update galactic_private.matches set stage='second'where id=p_match;end if;
 update galactic_private.matches set status='live',started_at=p_start,ends_at=p_start+off_ms*interval '1 millisecond',timeline=simulation.timeline,home_score=hs,away_score=aws,winner_id=winner,penalties=simulation.penalties,stats=simulation.stats||jsonb_build_object('engine',4)where id=p_match;
 update galactic_private.rooms set active_match=p_match,next_match_at=null where id=r.id;
end;$$;

create or replace function galactic_private.make_match(p_match uuid,p_start timestamptz)returns void language plpgsql set search_path='' as $$
declare m galactic_private.matches%rowtype;v int;
begin
 select * into m from galactic_private.matches where id=p_match;select(config->>'engineVersion')::int into v from galactic_private.datasets d join galactic_private.rooms r on r.dataset_version=d.version where r.id=m.room_id;
 if v<4 then perform galactic_private.make_match_v3(p_match,p_start);return;end if;
 update galactic_private.matches set home_setup=galactic_private.member_setup(m.room_id,m.home_id),away_setup=galactic_private.member_setup(m.room_id,m.away_id)where id=p_match;
 update galactic_private.matches set initial_home=home_setup,initial_away=away_setup where id=p_match;
 perform galactic_private.simulate_v4(p_match,p_start,false);
end;$$;
create or replace function galactic_private.create_bracket(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;ids uuid[];rot uuid[];n int;i int;j int;h uuid;a uuid;
begin
 select * into r from galactic_private.rooms where id=p_room;
 if r.competition='cup'then perform galactic_private.create_bracket_v3(p_room,p_at);update galactic_private.rooms set next_match_at=p_at+interval '60 seconds'where id=p_room;return;end if;
 select array_agg(id order by joined_at,id)into ids from galactic_private.members where room_id=p_room;n:=array_length(ids,1);if n%2=1 then ids:=array_append(ids,null);n:=n+1;end if;
 for i in 1..n-1 loop
  for j in 1..n/2 loop
   h:=ids[j];a:=ids[n+1-j];if i%2=0 then h:=ids[n+1-j];a:=ids[j];end if;
   if h is not null and a is not null then insert into galactic_private.matches(room_id,round,slot,home_id,away_id,status)values(p_room,i,j,h,a,'ready');end if;
  end loop;
  rot:=array[ids[1],ids[n]];for j in 2..n-1 loop rot:=array_append(rot,ids[j]);end loop;ids:=rot;
 end loop;
 update galactic_private.rooms set phase='tournament',pick_deadline=null,next_match_at=p_at+interval '60 seconds'where id=p_room;
end;$$;
create or replace function galactic_private.standings(rid uuid)returns jsonb language sql stable set search_path='' as $$
 with results as(
 select home_id id,away_id opponent,home_score gf,away_score ga from galactic_private.matches where room_id=rid and status='finished'
 union all select away_id,home_id,away_score,home_score from galactic_private.matches where room_id=rid and status='finished'),
 base as(select m.id,m.team_name,m.name,count(x.id)::int played,count(*)filter(where x.gf>x.ga)::int won,count(*)filter(where x.gf=x.ga)::int drawn,count(*)filter(where x.gf<x.ga)::int lost,coalesce(sum(x.gf),0)::int gf,coalesce(sum(x.ga),0)::int ga,coalesce(sum(x.gf-x.ga),0)::int gd,coalesce(sum(case when x.gf>x.ga then 3 when x.gf=x.ga then 1 else 0 end),0)::int points from galactic_private.members m left join results x on x.id=m.id where m.room_id=rid group by m.id),
 h2h as(select b.*,coalesce((select sum(case when x.gf>x.ga then 3 when x.gf=x.ga then 1 else 0 end)from results x join base o on o.id=x.opponent where x.id=b.id and o.points=b.points and o.gd=b.gd and o.gf=b.gf),0)::int head_to_head from base b),
 ranked as(select *,rank()over(order by points desc,gd desc,gf desc,head_to_head desc)position from h2h)
 select coalesce(jsonb_agg(to_jsonb(r)order by position,team_name,id),'[]')from ranked r
$$;
create or replace function galactic_private.offer(p_room uuid,p_member uuid,p_context text,p_slot text,p_reroll boolean default false,p_formation text default null)returns jsonb language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;d galactic_private.datasets%rowtype;mem galactic_private.members%rowtype;mm galactic_private.matches%rowtype;o galactic_private.offers%rowtype;role text;f text;ord int;target int;chosen jsonb;old_best int;v_round int;
begin
 select * into r from galactic_private.rooms where id=p_room;select * into mem from galactic_private.members where room_id=p_room and id=p_member;select * into d from galactic_private.datasets where version=r.dataset_version;
 f:=mem.formation;
 if p_context<>'draft'then
  select * into mm from galactic_private.matches where id=p_context::uuid and room_id=p_room and(mem.id=home_id or mem.id=away_id);
  if mm.id is null or(case when mm.home_id=mem.id then mm.home_saved else mm.away_saved end)or mm.stage<>'first'or clock_timestamp()<mm.halftime_at or clock_timestamp()>=mm.halftime_until then raise exception 'زمان تغییرات بین دو نیمه نیست.';end if;
  f:=case when mem.id=mm.home_id then mm.home_setup else mm.away_setup end->>'formation';v_round:=mm.round;
 elsif r.phase<>'draft'then raise exception 'زمان انتخاب بازیکن نیست.';end if;
 if p_context<>'draft'and p_formation is not null and(d.config->'formations')?p_formation then f:=p_formation;end if;
 select s->>'role',i::int into role,ord from jsonb_array_elements(d.config#>array['formations',f,'slots'])with ordinality q(s,i)where s->>'id'=p_slot;
 if role is null then raise exception 'جایگاه معتبر نیست.';end if;
 select * into o from galactic_private.offers where room_id=p_room and member_id=p_member and context=p_context and slot=p_slot;
 if p_reroll and mem.rerolls?p_context then raise exception 'ری‌رول این نوبت قبلاً استفاده شده است.';end if;
 if o.room_id is not null and not p_reroll then return o.players;end if;
 target:=case when (ord+floor(galactic_private.random_value(r.seed||p_member::text,1)*11)::int)%11<4 then 86 else 78 end;
 select max((p->>'overall')::int)into old_best from jsonb_array_elements(d.players)p where o.players?(p->>'id');
 if p_reroll then target:=least(99,coalesce(old_best,target)+4);end if;
 select coalesce(jsonb_agg(p->>'id'),'[]')into chosen from(
  select p from jsonb_array_elements(d.players)p where p->'positions'?role
  and not exists(select 1 from galactic_private.picks pk where pk.room_id=p_room and pk.player_id=p->>'id')
  and not exists(select 1 from galactic_private.reserves z where z.room_id=p_room and z.round=v_round and z.player_id=p->>'id')
  and(not p_reroll or not coalesce(o.players,'[]')?(p->>'id'))
  order by case when p_reroll then greatest(0,coalesce(old_best,0)+1-(p->>'overall')::int)else greatest(0,abs((p->>'overall')::int-target)-4)end,
  galactic_private.random_value(r.seed||p_member::text||p_context||p_slot||case when p_reroll then ':reroll'else ''end,hashtext(p->>'id')) limit 5
 )q;
 if p_reroll and(select max((p->>'overall')::int)from jsonb_array_elements(d.players)p where chosen?(p->>'id'))<=old_best then raise exception 'بازیکن قوی‌تری برای این جایگاه باقی نمانده؛ ری‌رول تو حفظ شد.';end if;
 if jsonb_array_length(chosen)=0 then raise exception 'بازیکن آزادی برای این جایگاه باقی نمانده است.';end if;
 insert into galactic_private.offers values(p_room,p_member,p_context,p_slot,chosen,p_reroll)on conflict(room_id,member_id,context,slot)do update set players=excluded.players,rerolled=excluded.rerolled;
 if p_reroll then update galactic_private.members set rerolls=rerolls||jsonb_build_object(p_context,true)where id=p_member;end if;
 return chosen;
end;$$;
create or replace function galactic_private.auto_pick(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;who uuid;slot text;opts jsonb;pid text;
begin
 select * into r from galactic_private.rooms where id=p_room;
 if r.selection='normal'then perform galactic_private.auto_pick_v3(p_room,p_at);return;end if;
 who:=galactic_private.turn_member(r);
 select s->>'id'into slot from galactic_private.members m join galactic_private.datasets d on d.version=r.dataset_version cross join jsonb_array_elements(d.config#>array['formations',m.formation,'slots'])with ordinality q(s,i)where m.id=who and not exists(select 1 from galactic_private.picks p where p.room_id=p_room and p.member_id=who and p.slot_id=s->>'id')order by i limit 1;
 opts:=galactic_private.offer(p_room,who,'draft',slot,false);
 select id into pid from jsonb_array_elements_text(opts)q(id)where not exists(select 1 from galactic_private.picks p where p.room_id=p_room and p.player_id=id)limit 1;
 if pid is null then
  -- Replenish only when every saved option was taken by other teams; no free quality upgrade.
  delete from galactic_private.offers where room_id=p_room and member_id=who and context='draft'and galactic_private.offers.slot=auto_pick.slot;
  opts:=galactic_private.offer(p_room,who,'draft',slot,false);pid:=opts->>0;
 end if;
 perform galactic_private.do_pick(p_room,who,pid,slot,true,p_at);
end;$$;

create or replace function galactic_private.advance(p_room uuid,p_now timestamptz)returns boolean language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;m galactic_private.matches%rowtype;w galactic_private.matches%rowtype;s1 galactic_private.matches%rowtype;s2 galactic_private.matches%rowtype;changed boolean:=false;iteration int;v_round int;v_start timestamptz;v_engine int;
begin
 select coalesce((d.config->>'engineVersion')::int,1)into v_engine from galactic_private.rooms rr join galactic_private.datasets d on d.version=rr.dataset_version where rr.id=p_room;
 if v_engine<2 then return galactic_private.advance_v1(p_room,p_now);end if;
 for iteration in 1..128 loop
  select * into r from galactic_private.rooms where id=p_room;
  if r.phase='draft'then
   if r.pick_deadline<=p_now then perform galactic_private.auto_pick(p_room,r.pick_deadline);changed:=true;continue;end if;exit;
  elsif r.phase='tournament'then
   for m in select * from galactic_private.matches where room_id=p_room and status='live'and ends_at<=p_now loop
 if m.stage='first'then perform galactic_private.simulate_v4(m.id,m.started_at,true);select * into m from galactic_private.matches where id=m.id;end if;
 if m.ends_at<=p_now then update galactic_private.matches set status='finished'where id=m.id;end if;changed:=true;end loop;
   for w in select * from galactic_private.matches where room_id=p_room and status='waiting'order by round,slot loop
    select * into s1 from galactic_private.matches where id=w.source_home;select * into s2 from galactic_private.matches where id=w.source_away;
    if s1.status in('finished','bye')and s2.status in('finished','bye')then update galactic_private.matches set home_id=s1.winner_id,away_id=s2.winner_id,status=case when s1.winner_id is null or s2.winner_id is null then 'bye'else 'ready'end,winner_id=case when s1.winner_id is null or s2.winner_id is null then coalesce(s1.winner_id,s2.winner_id)end where id=w.id;changed:=true;end if;
   end loop;
   if not exists(select 1 from galactic_private.matches where room_id=p_room and status not in('finished','bye'))then
    select * into m from galactic_private.matches where room_id=p_room order by round desc,slot limit 1;update galactic_private.rooms set phase='finished',winner=case when r.competition='league'then (case when (select count(*)from jsonb_array_elements(galactic_private.standings(p_room))q where(q->>'position')::int=1)=1 then(galactic_private.standings(p_room)->0->>'id')::uuid end)else m.winner_id end,next_match_at=null where id=p_room;changed:=true;exit;
   end if;
   if exists(select 1 from galactic_private.matches where room_id=p_room and status='live')then exit;end if;
   select min(round)into v_round from galactic_private.matches where room_id=p_room and status='ready';
   v_start:=r.next_match_at;
   if v_start is null then select max(ends_at)+interval '10 seconds'into v_start from galactic_private.matches where room_id=p_room and status='finished';update galactic_private.rooms set next_match_at=v_start where id=p_room;changed:=true;end if;
   if v_start<=p_now and v_round is not null then
    for m in select * from galactic_private.matches where room_id=p_room and status='ready'and round=v_round order by slot loop perform galactic_private.make_match(m.id,v_start);end loop;
    changed:=true;continue;
   end if;exit;
  else exit;end if;
 end loop;
 if changed then update galactic_private.rooms set version=version+1,updated_at=p_now where id=p_room;perform galactic_private.notify_room(p_room);end if;return changed;
end;$$;

create or replace function galactic_private.checked_roles(players jsonb,roles jsonb,sent jsonb default '[]')returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;pid text;result jsonb:='{}';
begin
 foreach k in array array['captain','penalty','freeKick']loop
  pid:=roles->>k;
  if pid is not null and pid<>''and not exists(select 1 from jsonb_array_elements(players)p where p->>'id'=pid and not sent?pid)then raise exception 'مسئولیت باید به یکی از بازیکنان حاضر در زمین داده شود.';end if;
  if pid is null or pid=''then select p->>'id'into pid from jsonb_array_elements(players)p where not sent?(p->>'id')order by case k when 'penalty'then galactic_private.skill(p,'penalties')when 'freeKick'then galactic_private.skill(p,'freeKicks')else galactic_private.skill(p,'composure')end desc,p->>'id'limit 1;end if;
  result:=result||jsonb_build_object(k,pid);
 end loop;return result;
end;$$;
create or replace function public.galactic_create_room(p_title text,p_public boolean default false,p_capacity int default 8,p_competition text default 'cup',p_selection text default 'normal')returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;rid uuid;u uuid:=galactic_private.require_user();
begin
 if p_competition not in('cup','league')or p_selection not in('normal','draft')or p_competition is null or p_selection is null then raise exception 'نوع رقابت را انتخاب کن.';end if;
 v:=public.galactic_create(p_title,p_public,p_capacity);rid:=(v->>'id')::uuid;
 update galactic_private.rooms set competition=p_competition,selection=p_selection where id=rid;
 return galactic_private.room_view(rid,u,clock_timestamp());
end;$$;
create or replace function public.galactic_act(p_code text,p_action jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;mem galactic_private.members%rowtype;d galactic_private.datasets%rowtype;stamp timestamptz:=clock_timestamp();kind text:=p_action->>'type';mm galactic_private.matches%rowtype;s jsonb;initial jsonb;submitted jsonb;lineup jsonb;f text;t text;context text;slot text;pid text;opts jsonb;sent jsonb;v_roles jsonb;v_count int;is_home boolean;other_id uuid;
begin
 select * into r from galactic_private.rooms where code=upper(trim(p_code))for update;
 if r.id is null then raise exception 'اتاق پیدا نشد.';end if;select * into mem from galactic_private.members where room_id=r.id and user_id=u;
 if mem.id is null then raise exception 'عضو این اتاق نیستی.'using errcode='42501';end if;
 stamp:=clock_timestamp();perform galactic_private.advance(r.id,stamp);select * into r from galactic_private.rooms where id=r.id;select * into d from galactic_private.datasets where version=r.dataset_version;
 if kind in('offers','reroll')then
  if r.selection<>'draft'then raise exception 'این اتاق حالت انتخاب آزاد دارد.';end if;
  context:=coalesce(p_action->>'match','draft');slot:=p_action->>'slot';
  opts:=galactic_private.offer(r.id,mem.id,context,slot,kind='reroll',p_action->>'formation');
 elsif kind='roles'then
  if r.phase not in('draft','tournament')or exists(select 1 from galactic_private.matches where room_id=r.id and status='live')then raise exception 'مسئولیت‌ها را پیش از شروع بازی یا در پنجرهٔ بین دو نیمه تغییر بده.';end if;
  v_roles:=galactic_private.checked_roles(galactic_private.lineup(r.id,mem.id),p_action->'roles');update galactic_private.members set roles=v_roles where id=mem.id;
 elsif kind='halftime'then
  select * into mm from galactic_private.matches where id=(p_action->>'match')::uuid and room_id=r.id and(mem.id=home_id or mem.id=away_id);
  if mm.id is null or mm.stage<>'first'or stamp<mm.halftime_at or stamp>=mm.halftime_until then raise exception 'زمان دو دقیقه‌ای بین دو نیمه تمام شده یا هنوز شروع نشده است.';end if;
  if coalesce((d.config->>'engineVersion')::int,1)>=5 and(case when mm.home_id=mem.id then mm.home_saved else mm.away_saved end)then raise exception 'تغییرات ذخیره و قفل شده‌اند؛ منتظر ادامهٔ بازی باش.';end if;
  is_home:=mem.id=mm.home_id;s:=case when is_home then mm.home_setup else mm.away_setup end;initial:=case when is_home then mm.initial_home else mm.initial_away end;sent:=case when is_home then mm.sim_state->'rh'else mm.sim_state->'ra'end;
  f:=p_action->>'formation';t:=p_action->>'tactic';submitted:=p_action->'players';
  if not(d.config->'formations')?coalesce(f,'')or not(d.config->'tactics')?coalesce(t,'')or jsonb_typeof(submitted)is distinct from 'array'or jsonb_array_length(submitted)<>11 then raise exception 'ترکیب باید یازده جایگاه معتبر داشته باشد.';end if;
  if(select count(distinct p->>'id')from jsonb_array_elements(submitted)p)<>11 or(select count(distinct p->>'slot')from jsonb_array_elements(submitted)p)<>11 then raise exception 'بازیکن یا جایگاه تکراری است.';end if;
  select count(*)into v_count from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id');
  if v_count>5 then raise exception 'حداکثر پنج تعویض مجاز است.';end if;
  if exists(select 1 from jsonb_array_elements_text(sent)q(id)where not exists(select 1 from jsonb_array_elements(submitted)p where p->>'id'=q.id))then raise exception 'بازیکن اخراج‌شده قابل تعویض نیست.';end if;
  if exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(d.players)dp where dp->>'id'=p->>'id')or not exists(select 1 from jsonb_array_elements(d.config#>array['formations',f,'slots'])sp where sp->>'id'=p->>'slot'))then raise exception 'بازیکن یا جایگاه ناشناخته است.';end if;
  if exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id')and(exists(select 1 from galactic_private.picks pk where pk.room_id=r.id and pk.player_id=p->>'id')or exists(select 1 from galactic_private.reserves z where z.room_id=r.id and z.round=mm.round and z.member_id<>mem.id and z.player_id=p->>'id')))then raise exception 'این بازیکن در اختیار تیم دیگری است.';end if;
  if r.selection='draft'and exists(select 1 from jsonb_array_elements(submitted)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id')and not exists(select 1 from galactic_private.offers o where o.room_id=r.id and o.member_id=mem.id and o.context=mm.id::text and o.players?(p->>'id')))then raise exception 'تعویض در حالت درفت فقط از پیشنهادهای ذخیره‌شده مجاز است.';end if;
  select jsonb_agg(dp||sp||jsonb_build_object('slot',sp->>'id','id',dp->>'id','fit',galactic_private.fit(dp->'positions',sp->>'role',d.config),'joinedMinute',case when exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=dp->>'id')then 0 else 45 end)order by ord)into lineup from jsonb_array_elements(submitted)p join jsonb_array_elements(d.players)dp on dp->>'id'=p->>'id'join jsonb_array_elements(d.config#>array['formations',f,'slots'])with ordinality q(sp,ord)on sp->>'id'=p->>'slot';
  v_roles:=galactic_private.checked_roles(lineup,p_action->'roles',sent);lineup:=galactic_private.decorate(lineup,d.config,v_roles);
  s:=jsonb_build_object('formation',f,'tactic',t,'roles',v_roles,'players',lineup);
  delete from galactic_private.reserves where match_id=mm.id and member_id=mem.id;
  insert into galactic_private.reserves select r.id,mm.round,mm.id,mem.id,p->>'id'from jsonb_array_elements(lineup)p where not exists(select 1 from jsonb_array_elements(initial->'players')ip where ip->>'id'=p->>'id');
  if is_home then update galactic_private.matches set home_setup=s where id=mm.id;else update galactic_private.matches set away_setup=s where id=mm.id;end if;
  if coalesce((d.config->>'engineVersion')::int,1)>=5 then
   if is_home then update galactic_private.matches set home_saved=true where id=mm.id;else update galactic_private.matches set away_saved=true where id=mm.id;end if;
   select * into mm from galactic_private.matches where id=mm.id;
   if mm.home_saved and mm.away_saved then
    update galactic_private.matches set halftime_until=stamp,ends_at=stamp,timeline=jsonb_set(timeline,array[(jsonb_array_length(timeline)-1)::text,'untilMs'],to_jsonb(floor(extract(epoch from(stamp-started_at))*1000)::bigint))where id=mm.id;
    perform galactic_private.advance(r.id,stamp);
   end if;
  end if;
 else
  if kind='pick'and r.selection='draft'then
   pid:=p_action->>'player';slot:=p_action->>'slot';opts:=galactic_private.offer(r.id,mem.id,'draft',slot,false);
   if not opts?coalesce(pid,'')then raise exception 'فقط از پنج پیشنهاد این جایگاه انتخاب کن.';end if;
  end if;
  return galactic_private.act_v3(p_code,p_action);
 end if;
 update galactic_private.rooms set version=version+1,updated_at=stamp where id=r.id;perform galactic_private.notify_room(r.id);return galactic_private.room_view(r.id,u,stamp);
end;$$;
create or replace function galactic_private.match_view(p_match uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;m galactic_private.matches%rowtype;h jsonb;a jsonb;
begin
 v:=galactic_private.match_view_v3(p_match,p_now);if v is null then return null;end if;select * into m from galactic_private.matches where id=p_match;if m.stage is null then return v;end if;
 if coalesce((m.stats->>'engine')::int,0)>=5 then v:=jsonb_set(v,'{playback}',(v->'playback')||jsonb_build_object('minuteMs',800,'stoppageBase',(v->'events'->-1)->'stoppageBase'));end if;
 h:=case when m.stage='first'then m.initial_home else m.home_setup end;a:=case when m.stage='first'then m.initial_away else m.away_setup end;
 return v||jsonb_build_object('home',(v->'home')||galactic_private.public_setup(h),'away',(v->'away')||galactic_private.public_setup(a),'halftime',m.stage='first'and p_now>=m.halftime_at and p_now<m.halftime_until,'halftimeUntil',case when p_now>=m.halftime_at then m.halftime_until end);
end;$$;
create or replace function galactic_private.room_view(p_room uuid,p_uid uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb;r galactic_private.rooms%rowtype;mid uuid;mm galactic_private.matches%rowtype;own jsonb;offers jsonb;members jsonb;
begin
 v:=galactic_private.room_view_v3(p_room,p_uid,p_now);select * into r from galactic_private.rooms where id=p_room;mid:=(v->>'self')::uuid;
 select * into mm from galactic_private.matches where room_id=p_room and status='live'and(home_id=mid or away_id=mid)order by round desc limit 1;
 if mm.stage='first'and p_now>=mm.halftime_at and p_now<mm.halftime_until then own:=jsonb_build_object('match',mm.id,'until',mm.halftime_until,'saved',case when mm.home_id=mid then mm.home_saved else mm.away_saved end,'setup',galactic_private.public_setup(case when mm.home_id=mid then mm.home_setup else mm.away_setup end),'initial',galactic_private.public_setup(case when mm.home_id=mid then mm.initial_home else mm.initial_away end),'sentOff',case when mm.home_id=mid then mm.sim_state->'rh'else mm.sim_state->'ra'end);end if;
 select coalesce(jsonb_agg(jsonb_build_object('context',context,'slot',slot,'players',players,'rerolled',rerolled)),'[]')into offers from galactic_private.offers where room_id=p_room and member_id=mid;
 select jsonb_agg(p||jsonb_build_object('roles',m.roles))into members from jsonb_array_elements(v->'members')p join galactic_private.members m on m.id=(p->>'id')::uuid;
 return v||jsonb_build_object('competition',r.competition,'selection',r.selection,'members',members,'standings',case when r.competition='league'then galactic_private.standings(p_room)else '[]'::jsonb end,'offers',offers,'rerolls',(select rerolls from galactic_private.members where id=mid),'halftime',own,'unavailable',(select coalesce(jsonb_agg(player_id),'[]')from galactic_private.reserves where room_id=p_room and round=mm.round and member_id<>mid));
end;$$;
revoke execute on all functions in schema galactic_private from public,anon,authenticated;
revoke execute on function public.galactic_create_room(text,boolean,int,text,text)from public,anon;
grant execute on function public.galactic_create_room(text,boolean,int,text,text)to authenticated;

-- Defaults are chosen from the actual XI; managers may override all three.
create or replace function galactic_private.member_setup(rid uuid,mid uuid)returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('formation',m.formation,'tactic',m.tactic,'roles',q.roles,'players',galactic_private.decorate(p.players,d.config,q.roles))from galactic_private.members m join galactic_private.rooms r on r.id=m.room_id join galactic_private.datasets d on d.version=r.dataset_version cross join lateral(select galactic_private.lineup(rid,mid)players)p cross join lateral(select galactic_private.checked_roles(p.players,m.roles)roles)q where m.id=mid and r.id=rid
$$;

create or replace function public.galactic_lobbies()returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();rooms jsonb;mine jsonb;
begin
 select coalesce(jsonb_agg(x order by x->>'createdAt'desc),'[]')into rooms from(select jsonb_build_object('code',r.code,'competition',r.competition,'selection',r.selection,'title',r.title,'capacity',r.capacity,'count',(select count(*)from galactic_private.members m where m.room_id=r.id),'host',coalesce((select username from public.profiles where id=r.host_id),'بازیکن'),'createdAt',r.created_at)as x from galactic_private.rooms r where r.public and r.phase='lobby'and r.created_at>clock_timestamp()-interval '24 hours'order by r.created_at desc limit 30)t;
 select coalesce(jsonb_agg(x order by x->>'createdAt'desc),'[]')into mine from(select jsonb_build_object('code',r.code,'competition',r.competition,'selection',r.selection,'title',r.title,'phase',r.phase,'createdAt',r.created_at)as x from galactic_private.rooms r join galactic_private.members m on m.room_id=r.id and m.user_id=u where r.phase<>'cancelled'order by r.created_at desc limit 10)t;
 return jsonb_build_object('rooms',rooms,'mine',mine);
end;$$;

