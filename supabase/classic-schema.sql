-- Additive Classic upgrade: preserves the current website during rollout.
-- Existing player history is archived, never deleted by this script.
begin;
create schema if not exists classic_private;
revoke all on schema classic_private from public, anon, authenticated;
create table if not exists classic_private.content (singleton boolean primary key default true check(singleton), data jsonb not null);
create table if not exists classic_private.players (id uuid primary key references auth.users(id) on delete cascade, name text not null unique check(char_length(name) between 3 and 20), avatar text not null default '◉', restricted boolean not null default false);
create table if not exists classic_private.daily (day text not null, game text not null, state jsonb not null, primary key(day,game));
create table if not exists classic_private.games (user_id uuid not null references auth.users(id) on delete cascade, game_key text not null, state jsonb not null, updated_at timestamptz not null default clock_timestamp(), primary key(user_id,game_key));
create table if not exists classic_private.coins (user_id uuid not null references auth.users(id) on delete cascade, event_key text not null, amount integer not null, source text not null, day text not null, created_at timestamptz not null default clock_timestamp(), primary key(user_id,event_key), legacy_id bigint unique);
create table if not exists classic_private.streaks (user_id uuid not null references auth.users(id) on delete cascade, game text not null, day text not null, count integer not null check(count>=0), primary key(user_id,game));
create table if not exists classic_private.teams (day text not null, user_id uuid not null references auth.users(id) on delete cascade, team text not null check(team in ('coral','blue')), slot integer not null, score integer check(score between 0 and 4), primary key(day,user_id), unique(day,team,slot));
create table if not exists classic_private.team_results (day text primary key, winner text not null, coral_score bigint not null, blue_score bigint not null);
create index if not exists classic_games_day on classic_private.games ((state->>'date'),(state->>'game'));
create index if not exists classic_coins_day on classic_private.coins (day,source);
create index if not exists classic_teams_user on classic_private.teams (user_id);
-- All access is via narrowly granted RPC functions; no browser has table privileges.
alter table classic_private.content enable row level security;
alter table classic_private.players enable row level security;
alter table classic_private.daily enable row level security;
alter table classic_private.games enable row level security;
alter table classic_private.coins enable row level security;
alter table classic_private.streaks enable row level security;
alter table classic_private.teams enable row level security;
alter table classic_private.team_results enable row level security;
revoke all on all tables in schema classic_private from public,anon,authenticated;
revoke all on all sequences in schema classic_private from public,anon,authenticated;
alter default privileges in schema classic_private revoke execute on functions from public,anon,authenticated;

-- Snapshot the touched legacy data and permissions before the additive rollout.
lock table public.profiles, public.coin_transactions, public.game_streaks in share row exclusive mode;
create table if not exists classic_private.prelaunch_backup (singleton boolean primary key default true check(singleton), captured_at timestamptz not null default clock_timestamp(), data jsonb not null);
alter table classic_private.prelaunch_backup enable row level security;
revoke all on classic_private.prelaunch_backup from public,anon,authenticated;
insert into classic_private.prelaunch_backup(singleton,data)
select true,jsonb_build_object('profiles',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.profiles p),'coins',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.coin_transactions c),'streaks',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.game_streaks s),'functions',(select coalesce(jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl)),'[]') from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='award_coins'),'profile_grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from information_schema.role_table_grants g where table_schema='public' and table_name='profiles')) on conflict do nothing;
-- Preserve identities, moderation restrictions and balances without exposing private fields.
insert into classic_private.players(id,name,restricted) select id,username,leaderboard_restricted from public.profiles on conflict(id) do nothing;
insert into classic_private.coins(user_id,event_key,amount,source,day,created_at,legacy_id) select user_id,'legacy:'||id,amount,source,date_key,created_at,id from public.coin_transactions on conflict do nothing;
insert into classic_private.streaks(user_id,game,day,count) select user_id,game,last_win_date_key,current_streak from public.game_streaks where last_win_date_key is not null and game in ('wordle','factle','colordle','chordle','memorydle','teamdle') on conflict do nothing;
-- Internal legacy awards still work for existing games, but browsers cannot call
-- the arbitrary-amount helper directly. Other legacy APIs keep their privileges.
revoke execute on function public.award_coins(uuid,text,integer,text) from public,anon,authenticated;
-- Existing profile editing remains available; moderation is server-owned.
revoke update on public.profiles from public,anon,authenticated;
grant update(username,avatar,birth_date,country) on public.profiles to authenticated;

create or replace function classic_private.game_day() returns text language sql stable set search_path='' as $$select to_char((now() at time zone 'Asia/Tehran')+interval '3 hours','YYYY-MM-DD')$$;
create or replace function classic_private.canon(p text) returns text language sql immutable set search_path='' as $$select regexp_replace(translate(coalesce(p,''),'آيك','ایک'),'[[:space:]‌]','','g')$$;
create or replace function classic_private.shuffled(p jsonb) returns jsonb language sql volatile set search_path='' as $$select coalesce(jsonb_agg(value order by random()),'[]'::jsonb) from jsonb_array_elements(p)$$;
create or replace function classic_private.balance(p_uid uuid) returns bigint language sql stable set search_path='' as $$select coalesce(sum(amount),0)::bigint from classic_private.coins where user_id=p_uid$$;
create or replace function classic_private.ensure_player() returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_name text;
begin
 if v_uid is null then raise exception 'ابتدا وارد حساب شو.' using errcode='28000';end if;
 if not exists(select 1 from classic_private.players where id=v_uid) then
  select username into v_name from public.profiles where id=v_uid;
  insert into classic_private.players(id,name) values(v_uid,coalesce(v_name,'user_'||substr(replace(v_uid::text,'-',''),1,10))) on conflict(id) do nothing;
 end if;return v_uid;
end;$$;
create or replace function classic_private.cell_map(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='{}'; slot jsonb; word text; i integer; r integer;c integer;k text;
begin
 for slot in select value from jsonb_array_elements(p->'slots') loop
  word:=classic_private.canon(slot->>'word');
  for i in 0..char_length(word)-1 loop
   r:=(slot->>'row')::integer+case when slot->>'direction'='down' then i else 0 end;
   c:=(slot->>'col')::integer+case when slot->>'direction'='across' then i else 0 end;k:=r||'_'||c;
   if result?k and result->>k<>substr(word,i+1,1) then raise exception 'Crossword crossing conflict';end if;
   result:=result||jsonb_build_object(k,substr(word,i+1,1));
  end loop;
 end loop;return result;
end;$$;
create or replace function classic_private.new_state(p_game text,p_id text default null) returns jsonb language plpgsql set search_path='' as $$
declare d jsonb;s jsonb;puzzle jsonb:='{}';secret jsonb:='{}';c jsonb;arr jsonb;countries jsonb;rounds jsonb:='[]';levels jsonb:='[]';chords jsonb;sequences jsonb:='[]';seq jsonb;v_word text;v_max integer:=0;i integer;j integer;n integer;prev integer;values_list jsonb;
begin
 select data into d from classic_private.content where singleton;
 if d is null then raise exception 'محتوای بازی هنوز آماده نیست.';end if;
 if p_game='wordle' then
  select classic_private.canon(value) into v_word from jsonb_array_elements_text(d->'words')
  where classic_private.canon(value) not in (select x.state#>>'{secret,word}' from classic_private.daily x where x.game='wordle' and x.day>to_char(now()-interval '60 days','YYYY-MM-DD')) order by random() limit 1;
  if v_word is null then select classic_private.canon(value) into v_word from jsonb_array_elements_text(d->'words') order by random() limit 1;end if;
  puzzle:=jsonb_build_object('length',char_length(v_word));secret:=jsonb_build_object('word',v_word);v_max:=6;
 elsif p_game in ('factle','teamdle') then
  select jsonb_agg(value) into countries from (select value from jsonb_array_elements(classic_private.shuffled(d->'countries')) limit case when p_game='factle' then 5 else 4 end) t;
  for c in select value from jsonb_array_elements(countries) loop
   if p_game='factle' then rounds:=rounds||jsonb_build_array(jsonb_build_object('fact',c->'facts'->(floor(random()*jsonb_array_length(c->'facts'))::integer),'source',c->>'source'));
   else
    v_word:=c->>'otherCity';
    rounds:=rounds||jsonb_build_array(jsonb_build_object('id',c->>'id','name',c->>'name','choices',classic_private.shuffled(jsonb_build_array(c->>'capital',v_word))));
   end if;
  end loop;
  secret:=jsonb_build_object('countries',countries);puzzle:=jsonb_build_object('rounds',rounds,'startedAt','{}'::jsonb);v_max:=case when p_game='factle' then 5 else 4 end;
 elsif p_game='colordle' then
  select value into c from jsonb_array_elements(d->'colors') order by random() limit 1;secret:=jsonb_build_object('color',c);puzzle:=jsonb_build_object('revealedAt',null);v_max:=10;
 elsif p_game='memorydle' then
  for i in 0..1 loop
   select jsonb_agg(t.number order by random()) into values_list from (select gs.number from generate_series(case when i=0 then 0 else 100 end,case when i=0 then 99 else 999 end) as gs(number) order by random() limit 15) t;
   select jsonb_agg(value) into arr from (select value from jsonb_array_elements(values_list) limit 5)t;
   levels:=levels||jsonb_build_array(jsonb_build_object('targets',arr,'grid',classic_private.shuffled(values_list)));
  end loop;
  select jsonb_agg(value->'grid') into arr from jsonb_array_elements(levels);secret:=jsonb_build_object('levels',levels);puzzle:=jsonb_build_object('grids',arr,'startedAt','{}'::jsonb);v_max:=10;
 elsif p_game='chordle' then
  select jsonb_agg(value) into chords from (select value from jsonb_array_elements(d->'chords') order by random() limit 9)t;
  for i in 1..3 loop seq:='[]';prev:=-1;for j in 1..5 loop n:=floor(random()*9)::integer;while n=prev loop n:=floor(random()*9)::integer;end loop;seq:=seq||jsonb_build_array(n);prev:=n;end loop;sequences:=sequences||jsonb_build_array(seq);end loop;
  secret:=jsonb_build_object('sequences',sequences);puzzle:=jsonb_build_object('chords',chords);v_max:=15;
 elsif p_game='crossword' then
  select value into c from jsonb_array_elements(d->'crosswords') where value->>'id'=coalesce(p_id,d#>>'{crosswords,0,id}');
  if c is null then raise exception 'جدول پیدا نشد.';end if;
  select jsonb_agg((value-'word')||jsonb_build_object('length',char_length(classic_private.canon(value->>'word')))) into arr from jsonb_array_elements(c->'slots');
  secret:=jsonb_build_object('crossword',c);puzzle:=c||jsonb_build_object('slots',arr,'letters','{}'::jsonb,'correct','{}'::jsonb,'unlocked',false);
  select sum(char_length(classic_private.canon(value->>'word'))) into v_max from jsonb_array_elements(c->'slots');
 else raise exception 'بازی پیدا نشد.';end if;
 return jsonb_build_object('game',p_game,'date',classic_private.game_day(),'finished',false,'won',false,'score',0,'max',v_max,'history','[]'::jsonb,'secret',secret,'puzzle',puzzle,'createdAt',floor(extract(epoch from clock_timestamp())*1000),'reward',0);
end;$$;
create or replace function classic_private.view_state(s jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb:=s-'secret';arr jsonb;lv jsonb;i integer:=0;
begin
 if s->>'game'='wordle' and (s->>'finished')::boolean then result:=result||jsonb_build_object('answer',s#>>'{secret,word}');end if;
 if s->>'game'='colordle' and ((s->>'finished')::boolean or s#>>'{puzzle,revealedAt}' is not null) then result:=jsonb_set(result,'{puzzle,target}',s#>'{secret,color}');end if;
 if s->>'game'='chordle' then result:=jsonb_set(result,'{puzzle,sequences}',s#>'{secret,sequences}');end if;
 if s->>'game'='memorydle' then
  arr:='[]';for lv in select value from jsonb_array_elements(s#>'{secret,levels}') loop
   arr:=arr||jsonb_build_array(case when (s#>'{puzzle,startedAt}')?i::text then lv->'targets' else 'null'::jsonb end);i:=i+1;
  end loop;result:=jsonb_set(result,'{puzzle,targets}',arr);
 end if;return result;
end;$$;
create or replace function public.classic_get(p_game text,p_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=classic_private.ensure_player();v_day text:=classic_private.game_day();v_key text;v_daily_key text; s jsonb;v_index integer;v_team text;v_slot integer;
begin
 if p_game is null or p_game not in ('wordle','factle','colordle','chordle','memorydle','teamdle','crossword') then raise exception 'بازی پیدا نشد.';end if;
 if p_game='crossword' and p_id is null then select data#>>'{crosswords,0,id}' into p_id from classic_private.content where singleton;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 v_key:=case when p_game='crossword' then 'crossword:'||p_id else v_day||':'||p_game end;
 select state into s from classic_private.games where user_id=v_uid and game_key=v_key;
 if s is not null then return classic_private.view_state(s);end if;
 v_daily_key:=case when p_game='crossword' then 'crossword:'||p_id else p_game end;
 perform pg_advisory_xact_lock(hashtextextended(v_day||':'||v_daily_key,0));
 select state into s from classic_private.daily where day=v_day and game=v_daily_key;
 if s is null then s:=classic_private.new_state(p_game,p_id);insert into classic_private.daily values(v_day,v_daily_key,s);end if;
 if p_game='teamdle' then
  select count(*) into v_index from classic_private.teams where day=v_day;
  v_team:=case when v_index%2=0 then 'coral' else 'blue' end;v_slot:=v_index/2+1;
  insert into classic_private.teams(day,user_id,team,slot) values(v_day,v_uid,v_team,v_slot);
  s:=jsonb_set(s,'{puzzle,team}',to_jsonb(v_team));
 end if;
 insert into classic_private.games(user_id,game_key,state) values(v_uid,v_key,s);
 return classic_private.view_state(s);
end;$$;
