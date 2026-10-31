create or replace function galactic_private.create_bracket(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
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
create or replace function galactic_private.do_pick(p_room uuid,p_member uuid,p_player text,p_slot text,p_auto boolean,p_at timestamptz)returns void language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;
begin
 select * into r from galactic_private.rooms where id=p_room;
 insert into galactic_private.picks(room_id,number,member_id,player_id,slot_id,automatic,picked_at)values(p_room,r.pick_number,p_member,p_player,p_slot,p_auto,p_at);
 update galactic_private.rooms set pick_number=pick_number+1,pick_deadline=p_at+interval '60 seconds'where id=p_room;
 if r.pick_number+1=jsonb_array_length(r.draft_order)*11 then perform galactic_private.create_bracket(p_room,p_at);end if;
end;$$;
create or replace function galactic_private.auto_pick(p_room uuid,p_at timestamptz)returns void language plpgsql set search_path='' as $$
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
create or replace function galactic_private.advance_v1(p_room uuid,p_now timestamptz)returns boolean language plpgsql set search_path='' as $$
declare r galactic_private.rooms%rowtype;m galactic_private.matches%rowtype;s1 galactic_private.matches%rowtype;s2 galactic_private.matches%rowtype;w galactic_private.matches%rowtype;changed boolean:=false;iteration int;
begin
 for iteration in 1..128 loop
  select * into r from galactic_private.rooms where id=p_room;
  if r.phase='draft'then
   if r.pick_deadline<=p_now then perform galactic_private.auto_pick(p_room,r.pick_deadline);changed:=true;continue;end if;exit;
  elsif r.phase='tournament'then
   if r.active_match is not null then
    select * into m from galactic_private.matches where id=r.active_match;
    if m.status='live'then if m.ends_at>p_now then exit;end if;update galactic_private.matches set status='finished'where id=m.id;update galactic_private.rooms set next_match_at=m.ends_at+interval '10 seconds'where id=p_room;changed:=true;end if;
   end if;
   -- Resolve only sources that actually finished. An unresolved future team is
   -- never treated as a bye, so brackets cannot advance prematurely.
   for w in select * from galactic_private.matches where room_id=p_room and status='waiting'order by round,slot loop
    select * into s1 from galactic_private.matches where id=w.source_home;select * into s2 from galactic_private.matches where id=w.source_away;
    if s1.status in('finished','bye')and s2.status in('finished','bye')then update galactic_private.matches set home_id=s1.winner_id,away_id=s2.winner_id,status=case when s1.winner_id is null or s2.winner_id is null then 'bye'else 'ready'end,winner_id=case when s1.winner_id is null or s2.winner_id is null then coalesce(s1.winner_id,s2.winner_id)end where id=w.id;changed:=true;end if;
   end loop;
   if not exists(select 1 from galactic_private.matches where room_id=p_room and status not in('finished','bye'))then
    select * into m from galactic_private.matches where room_id=p_room order by round desc,slot limit 1;update galactic_private.rooms set phase='finished',winner=m.winner_id,next_match_at=null where id=p_room;changed:=true;exit;
   end if;
   select * into r from galactic_private.rooms where id=p_room;
   if r.next_match_at<=p_now then
    select * into m from galactic_private.matches where room_id=p_room and status='ready'order by round,slot limit 1;
    if m.id is not null then perform galactic_private.make_match(m.id,r.next_match_at);changed:=true;continue;end if;
   end if;exit;
  else exit;end if;
 end loop;
 if changed then update galactic_private.rooms set version=version+1,updated_at=p_now where id=p_room;perform galactic_private.notify_room(p_room);end if;
 return changed;
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
create or replace function galactic_private.match_view(p_match uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
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
create or replace function galactic_private.room_view(p_room uuid,p_uid uuid,p_now timestamptz)returns jsonb language plpgsql stable set search_path='' as $$
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
create or replace function public.galactic_catalog(p_version text default null)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();d galactic_private.datasets%rowtype;
begin
 select * into d from galactic_private.datasets where case when p_version is null then active else version=p_version end limit 1;if d.version is null then raise exception 'فهرست بازیکنان هنوز آماده نیست.';end if;
 return jsonb_build_object('version',d.version,'players',(select jsonb_agg(galactic_private.public_player(p))from jsonb_array_elements(d.players)p),'config',d.config,'sources',d.sources);
end;$$;
create or replace function public.galactic_lobbies()returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();rooms jsonb;mine jsonb;
begin
 select coalesce(jsonb_agg(x order by x->>'createdAt'desc),'[]')into rooms from(select jsonb_build_object('code',r.code,'title',r.title,'capacity',r.capacity,'count',(select count(*)from galactic_private.members m where m.room_id=r.id),'host',coalesce((select username from public.profiles where id=r.host_id),'بازیکن'),'createdAt',r.created_at)as x from galactic_private.rooms r where r.public and r.phase='lobby'and r.created_at>clock_timestamp()-interval '24 hours'order by r.created_at desc limit 30)t;
 select coalesce(jsonb_agg(x order by x->>'createdAt'desc),'[]')into mine from(select jsonb_build_object('code',r.code,'title',r.title,'phase',r.phase,'createdAt',r.created_at)as x from galactic_private.rooms r join galactic_private.members m on m.room_id=r.id and m.user_id=u where r.phase<>'cancelled'order by r.created_at desc limit 10)t;
 return jsonb_build_object('rooms',rooms,'mine',mine);
end;$$;
create or replace function public.galactic_create(p_title text,p_public boolean default false,p_capacity int default 8)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();d text;rid uuid;code text;player_name text;stamp timestamptz:=clock_timestamp();
begin
 if p_title is null or char_length(trim(p_title))not between 2 and 40 or p_title~'[<>[:cntrl:]]'or p_capacity is null or p_capacity not between 2 and 8 then raise exception 'نام اتاق و تعداد بازیکنان را بررسی کن.';end if;
 perform pg_advisory_xact_lock(hashtextextended('galactic:create:'||u::text,0));
 if(select count(*)from galactic_private.rooms where host_id=u and phase in('lobby','draft','tournament'))>=3 then raise exception 'ابتدا یکی از اتاق‌های فعلی را تمام کن.';end if;
 select version into d from galactic_private.datasets where active and jsonb_array_length(players)>=p_capacity*11;
 if d is null then raise exception 'فهرست بازیکنان برای این اتاق کافی نیست.';end if;
 select username into player_name from public.profiles where id=u;if player_name is null then raise exception 'ابتدا پروفایل حساب را تکمیل کن.';end if;
 code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into galactic_private.rooms(code,host_id,title,public,capacity,dataset_version)values(code,u,trim(p_title),coalesce(p_public,false),p_capacity,d)returning id into rid;
 insert into galactic_private.members(room_id,user_id,name,team_name)values(rid,u,player_name,'تیم '||left(player_name,25));
 return galactic_private.room_view(rid,u,stamp);
end;$$;
create or replace function public.galactic_join(p_code text)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;player_name text;stamp timestamptz:=clock_timestamp();
begin
 select * into r from galactic_private.rooms where code=upper(regexp_replace(trim(p_code),'[[:space:]-]','','g'))for update;
 if r.id is null then raise exception 'اتاق پیدا نشد.';end if;
 if exists(select 1 from galactic_private.members where room_id=r.id and user_id=u)then return galactic_private.room_view(r.id,u,stamp);end if;
 if r.phase<>'lobby'then raise exception 'انتخاب بازیکنان این اتاق شروع شده است.';end if;
 if(select count(*)from galactic_private.members where room_id=r.id)>=r.capacity then raise exception 'اتاق پر است.';end if;
 select username into player_name from public.profiles where id=u;if player_name is null then raise exception 'ابتدا پروفایل را تکمیل کن.';end if;
 insert into galactic_private.members(room_id,user_id,name,team_name)values(r.id,u,player_name,'تیم '||left(player_name,25));
 update galactic_private.rooms set version=version+1,updated_at=stamp where id=r.id;perform galactic_private.notify_room(r.id);
 return galactic_private.room_view(r.id,u,stamp);
end;$$;
create or replace function public.galactic_room(p_code text)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;stamp timestamptz:=clock_timestamp();
begin
 select * into r from galactic_private.rooms where code=upper(trim(p_code))for update;
 if r.id is null or not exists(select 1 from galactic_private.members where room_id=r.id and user_id=u)then raise exception 'ابتدا با کد دعوت به این اتاق بپیوند.'using errcode='42501';end if;
 update galactic_private.members set last_seen=stamp where room_id=r.id and user_id=u;
 perform galactic_private.advance(r.id,stamp);return galactic_private.room_view(r.id,u,stamp);
end;$$;
create or replace function public.galactic_act(p_code text,p_action jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=galactic_private.require_user();r galactic_private.rooms%rowtype;m galactic_private.members%rowtype;d galactic_private.datasets%rowtype;stamp timestamptz:=clock_timestamp();kind text:=p_action->>'type';f text;t text;v_team_name text;slot text;pid text;who uuid;order_ids jsonb;result jsonb;
begin
 select * into r from galactic_private.rooms where code=upper(trim(p_code))for update;
 if r.id is null then raise exception 'اتاق پیدا نشد.';end if;select * into m from galactic_private.members where room_id=r.id and user_id=u;
 if m.id is null then raise exception 'عضو این اتاق نیستی.'using errcode='42501';end if;
 perform galactic_private.advance(r.id,stamp);select * into r from galactic_private.rooms where id=r.id;select * into d from galactic_private.datasets where version=r.dataset_version;
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
create or replace function public.galactic_can_watch(p_topic text)returns boolean language sql stable security definer set search_path='' as $$select auth.uid()is not null and exists(select 1 from galactic_private.rooms r join galactic_private.members m on m.room_id=r.id where 'galactic:'||r.id::text=p_topic and m.user_id=auth.uid())$$;
revoke execute on all functions in schema galactic_private from public,anon,authenticated;
revoke execute on function public.galactic_catalog(text),public.galactic_lobbies(),public.galactic_create(text,boolean,int),public.galactic_join(text),public.galactic_room(text),public.galactic_act(text,jsonb),public.galactic_can_watch(text)from public,anon;
grant execute on function public.galactic_catalog(text),public.galactic_lobbies(),public.galactic_create(text,boolean,int),public.galactic_join(text),public.galactic_room(text),public.galactic_act(text,jsonb),public.galactic_can_watch(text)to authenticated;
