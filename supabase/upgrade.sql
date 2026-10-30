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
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 v_key:=case when p_game='crossword' then 'crossword:'||coalesce(p_id,'1') else v_day||':'||p_game end;
 select state into s from classic_private.games where user_id=v_uid and game_key=v_key;
 if s is not null then return classic_private.view_state(s);end if;
 v_daily_key:=case when p_game='crossword' then 'crossword:'||coalesce(p_id,'1') else p_game end;
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

create or replace function classic_private.word_feedback(p_guess text,p_word text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result text[]:=array_fill('absent'::text,array[char_length(p_word)]);remaining text:=p_word;c text;i integer;j integer;
begin
 for i in 1..char_length(p_word) loop if substr(p_guess,i,1)=substr(p_word,i,1) then result[i]:='correct';remaining:=overlay(remaining placing ' ' from i for 1);end if;end loop;
 for i in 1..char_length(p_guess) loop if result[i]<>'correct' then c:=substr(p_guess,i,1);j:=strpos(remaining,c);if j>0 then result[i]:='present';remaining:=overlay(remaining placing ' ' from j for 1);end if;end if;end loop;return to_jsonb(result);
end;$$;
create or replace function public.classic_act(p_game text,p_action jsonb,p_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare v_uid uuid:=classic_private.ensure_player();v_day text:=classic_private.game_day();v_key text;s jsonb;p jsonb;secret jsonb;history jsonb;d jsonb;kind text:=p_action->>'type';idx integer;score numeric;reward integer:=0;done boolean:=false;won boolean:=false;now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000);word text;country jsonb;selected jsonb;correct boolean;result jsonb;arr jsonb;target jsonb;level jsonb;cells jsonb;cell text;letter text;guess_rgb integer[];target_rgb integer[];dist numeric;i integer;round_score integer;rank_no integer;v_count integer;v_last text;v_old_count integer;v_cost integer;
begin
 -- A user-wide lock serializes purchases, claims and scores across tabs/games.
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 perform public.classic_get(p_game,p_id);
 v_key:=case when p_game='crossword' then 'crossword:'||coalesce(p_id,'1') else v_day||':'||p_game end;
 select state into s from classic_private.games where user_id=v_uid and game_key=v_key for update;
 if (s->>'finished')::boolean then return classic_private.view_state(s);end if;
 if p_game<>'crossword' and (s->>'date'<>v_day or p_action->>'day' is null or p_action->>'day'<>v_day) then raise exception 'بازی تازه‌ای شروع شده. صفحه را دوباره باز کن.';end if;
 select data into d from classic_private.content where singleton;
 p:=s->'puzzle';secret:=s->'secret';history:=s->'history';idx:=jsonb_array_length(history);score:=(s->>'score')::numeric;
 if p_game<>'crossword' and (p_action->>'round' is null or (p_action->>'round')::integer<>idx) then raise exception 'این دور قبلاً ثبت شده. صفحه را تازه کن.';end if;
 if p_game='wordle' and kind='guess' then
  word:=classic_private.canon(p_action->>'word');
  if char_length(word)<>(p->>'length')::integer or word !~ '^[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]+$' then raise exception 'حروف فارسی را با تعداد مشخص‌شده وارد کن.';end if;
  if exists(select 1 from jsonb_array_elements(history) h where h->>'word'=word) then raise exception 'این واژه را قبلاً امتحان کردی.';end if;
  result:=classic_private.word_feedback(word,secret->>'word');history:=history||jsonb_build_array(jsonb_build_object('word',word,'result',result));
  won:=word=secret->>'word';done:=won or idx=5;if won then score:=6-idx;reward:=50;end if;
 elsif p_game='factle' and kind='guess' then
  country:=secret->'countries'->idx;if country is null then raise exception 'دور معتبر نیست.';end if;
  select value into selected from jsonb_array_elements(d->'countries') where value->>'id'=p_action->>'country';
  if selected is null and not coalesce((p_action->>'skip')::boolean,false) then raise exception 'یک کشور از پیشنهادها انتخاب کن.';end if;
  correct:=coalesce(selected->>'id'=country->>'id',false);score:=score+case when correct then 1 else 0 end;
  history:=history||jsonb_build_array(jsonb_build_object('correct',correct,'answer',country->>'name','guess',coalesce(selected->>'name','گذشتم'),'source',country->>'source'));
  if idx=4 then done:=true;won:=score>=3;reward:=score::integer*20;end if;
 elsif p_game='colordle' then
  if kind='reveal' then
   if p->>'revealedAt' is null then p:=jsonb_set(p,'{revealedAt}',to_jsonb(now_ms));end if;
  elsif kind='color' then
   if p->>'revealedAt' is null or now_ms-(p->>'revealedAt')::bigint<10000 then raise exception 'اول رنگ را ببین و به خاطر بسپار.';end if;
   arr:=p_action->'rgb';if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr)<>3 then raise exception 'رنگ معتبر نیست.';end if;
   for i in 0..2 loop
    if jsonb_typeof(arr->i) is distinct from 'number' or (arr->>i)!~'^[0-9]{1,3}$' or (arr->>i)::integer not between 0 and 255 then raise exception 'رنگ معتبر نیست.';end if;
    guess_rgb[i+1]:=(arr->>i)::integer;target_rgb[i+1]:=get_byte(decode(substr(secret#>>'{color,hex}',2),'hex'),i);
   end loop;
   dist:=sqrt(power(guess_rgb[1]-target_rgb[1],2)+power(guess_rgb[2]-target_rgb[2],2)+power(guess_rgb[3]-target_rgb[3],2));score:=round(greatest(0,10*(1-dist/sqrt(3*255.0^2))),2);
   p:=p||jsonb_build_object('guess','#'||lpad(to_hex(guess_rgb[1]),2,'0')||lpad(to_hex(guess_rgb[2]),2,'0')||lpad(to_hex(guess_rgb[3]),2,'0'));done:=true;won:=score>=7;reward:=round(score*10)::integer;
  else raise exception 'درخواست معتبر نیست.';end if;
 elsif p_game='memorydle' then
  if idx>1 then raise exception 'دور معتبر نیست.';end if;
  if kind='start' then if not (p->'startedAt')?idx::text then p:=jsonb_set(p,'{startedAt}',(p->'startedAt')||jsonb_build_object(idx::text,now_ms));end if;
  elsif kind='memory' then
   if not (p->'startedAt')?idx::text or now_ms-(p#>>array['startedAt',idx::text])::bigint<12000 then raise exception 'اول نمایش اعداد را کامل ببین.';end if;
   arr:=p_action->'picks';level:=secret->'levels'->idx;
   if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr)<>5 or (select count(distinct value) from jsonb_array_elements(arr))<>5 then raise exception 'پنج عدد متفاوت انتخاب کن.';end if;
   if exists(select 1 from jsonb_array_elements(arr) a where not (level->'grid')@>jsonb_build_array(a)) then raise exception 'انتخاب معتبر نیست.';end if;
   select count(*) into round_score from jsonb_array_elements(arr) a where (level->'targets')@>jsonb_build_array(a);
   score:=score+round_score;history:=history||jsonb_build_array(jsonb_build_object('score',round_score,'targets',level->'targets','picks',arr));
   if idx=1 then done:=true;won:=score>=8;reward:=score::integer*10;end if;
  else raise exception 'درخواست معتبر نیست.';end if;
 elsif p_game='chordle' and kind='chords' then
  arr:=p_action->'slots';target:=secret->'sequences'->idx;
  if idx>2 or jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr)<>5 then raise exception 'هر پنج خانه را پر کن.';end if;
  result:='[]';round_score:=0;
  for i in 0..4 loop
   if jsonb_typeof(arr->i) is distinct from 'number' or (arr->>i)!~'^[0-8]$' then raise exception 'صدای معتبر انتخاب کن.';end if;
   correct:=arr->i=target->i;result:=result||jsonb_build_array(correct);if correct then round_score:=round_score+1;end if;
  end loop;
  score:=score+round_score;history:=history||jsonb_build_array(jsonb_build_object('score',round_score,'correct',result,'sequence',target));
  if idx=2 then done:=true;won:=score>=12;reward:=score::integer*10;end if;
 elsif p_game='teamdle' then
  if idx>3 then raise exception 'دور معتبر نیست.';end if;
  if kind='start' then if not (p->'startedAt')?idx::text then p:=jsonb_set(p,'{startedAt}',(p->'startedAt')||jsonb_build_object(idx::text,now_ms));end if;
  elsif kind='capital' then
   if not (p->'startedAt')?idx::text then raise exception 'اول دور را شروع کن.';end if;
   country:=secret->'countries'->idx;letter:=p_action->>'answer';
   if letter is not null and not (p->'rounds'->idx->'choices')@>jsonb_build_array(letter) then raise exception 'یکی از دو گزینه را انتخاب کن.';end if;
   correct:=coalesce(letter=country->>'capital' and now_ms-(p#>>array['startedAt',idx::text])::bigint<=6000,false);
   score:=score+case when correct then 1 else 0 end;history:=history||jsonb_build_array(jsonb_build_object('correct',correct,'answer',country->>'capital','name',country->>'name'));
   if idx=3 then done:=true;won:=score>=3;update classic_private.teams set score=score_value.n from (select score::integer as n) score_value where day=v_day and user_id=v_uid;end if;
  else raise exception 'درخواست معتبر نیست.';end if;
 elsif p_game='crossword' then
  if kind='purchase' then
   if not (p->>'unlocked')::boolean then
    v_cost:=(p->>'cost')::integer;if classic_private.balance(v_uid)<v_cost then raise exception 'هنوز سکهٔ کافی نداری.';end if;
    insert into classic_private.coins(user_id,event_key,amount,source,day) values(v_uid,v_key,-v_cost,'crossword',v_day) on conflict do nothing;p:=jsonb_set(p,'{unlocked}','true');
   end if;
  elsif not (p->>'unlocked')::boolean then raise exception 'اول جدول را باز کن.';
  elsif kind='letter' then
   cells:=classic_private.cell_map(secret->'crossword');cell:=p_action->>'cell';letter:=classic_private.canon(p_action->>'letter');
   if not cells?cell or (letter<>'' and letter!~'^[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]$') then raise exception 'حرف یا خانه معتبر نیست.';end if;
   p:=jsonb_set(p,'{letters}',(p->'letters')||jsonb_build_object(cell,letter));p:=jsonb_set(p,'{correct}','{}');
  elsif kind='check' then
   cells:=classic_private.cell_map(secret->'crossword');result:='{}';done:=true;
   for cell,letter in select key,value from jsonb_each_text(cells) loop correct:=coalesce(p->'letters'->>cell=letter,false);result:=result||jsonb_build_object(cell,correct);done:=done and correct;end loop;
   p:=jsonb_set(p,'{correct}',result);won:=done;if done then score:=(s->>'max')::numeric;end if;
  else raise exception 'درخواست معتبر نیست.';end if;
 else raise exception 'درخواست معتبر نیست.';end if;
 if done and p_game='wordle' and won and not (select restricted from classic_private.players where id=v_uid) then
  perform pg_advisory_xact_lock(hashtextextended('rank:'||v_day||p_game,0));
  select count(*)+1 into rank_no from classic_private.games g join classic_private.players pl on pl.id=g.user_id where g.game_key=v_key and (g.state->>'finished')::boolean and (g.state->>'won')::boolean and not pl.restricted;
  reward:=reward+case rank_no when 1 then 50 when 2 then 30 when 3 then 15 else 0 end;
 end if;
 s:=s||jsonb_build_object('date',v_day,'puzzle',p,'history',history,'score',score,'finished',done,'won',won,'reward',reward);
 update classic_private.games set state=s,updated_at=clock_timestamp() where user_id=v_uid and game_key=v_key;
 if done then
  if reward>0 then insert into classic_private.coins(user_id,event_key,amount,source,day) values(v_uid,'game:'||v_key,reward,p_game,v_day) on conflict do nothing;end if;
  if p_game<>'crossword' then
   select day,count into v_last,v_old_count from classic_private.streaks where user_id=v_uid and game=p_game;
   v_count:=case when not won then 0 when v_last=(v_day::date-1)::text then v_old_count+1 when v_last=v_day then v_old_count else 1 end;
   insert into classic_private.streaks(user_id,game,day,count) values(v_uid,p_game,v_day,v_count) on conflict(user_id,game) do update set day=excluded.day,count=excluded.count;
  end if;
 end if;
 return classic_private.view_state(s);
end;$$;

create or replace function classic_private.settle_teams() returns void language plpgsql security definer set search_path='' as $$
declare v_day text;v_coral bigint;v_blue bigint;v_winner text;
begin
 for v_day in select distinct t.day from classic_private.teams t where t.day<classic_private.game_day() and not exists(select 1 from classic_private.team_results r where r.day=t.day) order by t.day loop
  perform pg_advisory_xact_lock(hashtextextended('settlement:'||v_day,0));
  if exists(select 1 from classic_private.team_results where day=v_day) then continue;end if;
  select coalesce(sum(t.score) filter(where t.team='coral'),0),coalesce(sum(t.score) filter(where t.team='blue'),0) into v_coral,v_blue
  from classic_private.teams t where t.day=v_day and t.score is not null and exists(select 1 from classic_private.teams other where other.day=t.day and other.slot=t.slot and other.team<>t.team and other.score is not null);
  v_winner:=case when v_coral=v_blue then 'draw' when v_coral>v_blue then 'coral' else 'blue' end;
  insert into classic_private.team_results values(v_day,v_winner,v_coral,v_blue);
  insert into classic_private.coins(user_id,event_key,amount,source,day)
   select t.user_id,'team:'||v_day,case when v_winner='draw' then 75 else 150 end,'teamdle',v_day
   from classic_private.teams t where t.day=v_day and t.score is not null and (v_winner='draw' or t.team=v_winner)
   and exists(select 1 from classic_private.teams other where other.day=t.day and other.slot=t.slot and other.team<>t.team and other.score is not null)
   on conflict do nothing;
 end loop;
end;$$;
create or replace function public.classic_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=classic_private.ensure_player();p classic_private.players%rowtype;results jsonb;streaks jsonb;claim text;
begin
 perform classic_private.settle_teams();select * into p from classic_private.players where id=v_uid;
 select coalesce(jsonb_agg(jsonb_build_object('game',state->>'game','date',state->>'date','score',state->'score','max',state->'max','won',state->'won') order by updated_at),'[]'::jsonb) into results from (select state,updated_at from classic_private.games where user_id=v_uid and (state->>'finished')::boolean order by updated_at desc limit 120)t;
 select coalesce(jsonb_object_agg(game,jsonb_build_object('date',day,'count',case when day>=(classic_private.game_day()::date-1)::text then count else 0 end)),'{}'::jsonb) into streaks from classic_private.streaks where user_id=v_uid;
 select max(day) into claim from classic_private.coins where user_id=v_uid and source='daily_login';
 return jsonb_build_object('name',p.name,'avatar',p.avatar,'balance',classic_private.balance(v_uid),'claim',claim,'local',false,'streaks',streaks,'results',results);
end;$$;
create or replace function public.classic_update_profile(p_name text,p_avatar text) returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=classic_private.ensure_player();
begin
 if p_name is null or char_length(trim(p_name)) not between 3 and 20 or p_name!~'^[a-zA-Z0-9_آ-ی]+$' then raise exception 'نام کاربری باید ۳ تا ۲۰ حرف، عدد یا زیرخط باشد.';end if;
 if p_avatar is null or not p_avatar=any(array['◉','◇','△','□','○','⬡','◎','◈','🙂','🦊','🐱','🐼','🐸','🦉','🐙','👾']) then raise exception 'یک نشان از گزینه‌ها انتخاب کن.';end if;
 update public.profiles set username=trim(p_name) where id=v_uid;
 update classic_private.players set name=trim(p_name),avatar=p_avatar where id=v_uid;
 exception when unique_violation then raise exception 'این نام قبلاً انتخاب شده است.';
end;$$;
create or replace function public.classic_claim() returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=classic_private.ensure_player();v_day text:=classic_private.game_day();n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 if exists(select 1 from classic_private.coins where user_id=v_uid and day=v_day and source='daily_login') then return 0;end if;
 insert into classic_private.coins(user_id,event_key,amount,source,day) values(v_uid,'claim:'||v_day,25,'daily_login',v_day) on conflict do nothing;
 get diagnostics n=row_count;return n*25;
end;$$;
create or replace function public.classic_leaderboard(p_game text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_day text:=classic_private.game_day();result jsonb;totals jsonb;
begin
 if p_game not in ('wordle','factle','colordle','chordle','memorydle','teamdle') then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(entry order by rank_no),'[]'::jsonb) into result from (
 select jsonb_build_object('name',p.name,'avatar',p.avatar,'score',g.state->'score','max',g.state->'max','self',coalesce(p.id=auth.uid(),false),'team',t.team,'pending',case when t.user_id is null then false else not exists(select 1 from classic_private.teams other where other.day=t.day and other.slot=t.slot and other.team<>t.team and other.score is not null) end) as entry,
 row_number() over(order by case when p_game='wordle' then 0 else (g.state->>'score')::numeric end desc,g.updated_at) as rank_no
 from classic_private.games g join classic_private.players p on p.id=g.user_id
 left join classic_private.teams t on p_game='teamdle' and t.day=v_day and t.user_id=g.user_id
 where g.game_key=v_day||':'||p_game and (g.state->>'finished')::boolean and not p.restricted
 and (p_game<>'wordle' or (g.state->>'won')::boolean)
 order by rank_no limit 50)q;
 if p_game='teamdle' then
  select jsonb_build_object('coral',coalesce(sum(t.score) filter(where t.team='coral'),0),'blue',coalesce(sum(t.score) filter(where t.team='blue'),0)) into totals
  from classic_private.teams t where t.day=v_day and t.score is not null and exists(select 1 from classic_private.teams other where other.day=t.day and other.slot=t.slot and other.team<>t.team and other.score is not null);
  return jsonb_build_object('entries',result,'totals',totals);
 end if;
 return result;
end;$$;
-- Explicit Classic allowlist; legacy gameplay endpoints stay available during rollout.
revoke execute on all functions in schema classic_private from public,anon,authenticated;
revoke execute on function public.classic_get(text,text) from public,anon;
revoke execute on function public.classic_act(text,jsonb,text) from public,anon;
revoke execute on function public.classic_profile() from public,anon;
revoke execute on function public.classic_update_profile(text,text) from public,anon;
revoke execute on function public.classic_claim() from public,anon;
revoke execute on function public.classic_leaderboard(text) from public;
grant execute on function public.classic_get(text,text),public.classic_act(text,jsonb,text),public.classic_profile(),public.classic_update_profile(text,text),public.classic_claim() to authenticated;
grant execute on function public.classic_leaderboard(text) to anon,authenticated;
-- Content insertion and COMMIT are appended by npm run db:prepare.

-- Both clients share balances and identity while the old site remains online.
-- Legacy content/progress is retained; new puzzles live in classic_private.
create or replace function classic_private.sync_legacy_coin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if pg_trigger_depth()>1 then return new;end if;
 if tg_op='DELETE' then delete from classic_private.coins where legacy_id=old.id;return old;end if;
 insert into classic_private.coins(user_id,event_key,amount,source,day,created_at,legacy_id)
 values(new.user_id,'legacy:'||new.id,new.amount,new.source,new.date_key,new.created_at,new.id)
 on conflict(legacy_id) do update set amount=excluded.amount,source=excluded.source,day=excluded.day;
 return new;
end;$$;
create or replace function classic_private.sync_classic_coin() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id bigint;v_source text;
begin
 if pg_trigger_depth()>1 or new.legacy_id is not null then return new;end if;
 v_source:=case when new.source='daily_login' then 'daily_login' else 'classic:'||new.event_key end;
 insert into public.coin_transactions(user_id,date_key,source,amount,created_at) values(new.user_id,new.day,v_source,new.amount,new.created_at) returning id into v_id;
 update classic_private.coins set legacy_id=v_id where user_id=new.user_id and event_key=new.event_key;
 return new;
end;$$;
create or replace function classic_private.sync_legacy_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into classic_private.players(id,name,restricted) values(new.id,new.username,new.leaderboard_restricted)
 on conflict(id) do update set name=excluded.name,restricted=excluded.restricted;
 return new;
end;$$;
create or replace function classic_private.sync_legacy_streak() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if pg_trigger_depth()>1 or new.last_win_date_key is null or new.game not in ('wordle','factle','colordle','chordle','memorydle','teamdle') then return new;end if;
 insert into classic_private.streaks(user_id,game,day,count) values(new.user_id,new.game,new.last_win_date_key,new.current_streak)
 on conflict(user_id,game) do update set day=excluded.day,count=excluded.count;
 return new;
end;$$;
create or replace function classic_private.sync_classic_streak() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if pg_trigger_depth()>1 then return new;end if;
 insert into public.game_streaks(user_id,game,last_win_date_key,current_streak) values(new.user_id,new.game,new.day,new.count)
 on conflict(user_id,game) do update set last_win_date_key=excluded.last_win_date_key,current_streak=excluded.current_streak;
 return new;
end;$$;
drop trigger if exists classic_sync_coin on public.coin_transactions;
create trigger classic_sync_coin after insert or update or delete on public.coin_transactions for each row execute function classic_private.sync_legacy_coin();
drop trigger if exists classic_mirror_coin on classic_private.coins;
create trigger classic_mirror_coin after insert on classic_private.coins for each row execute function classic_private.sync_classic_coin();
drop trigger if exists classic_sync_profile on public.profiles;
create trigger classic_sync_profile after insert or update on public.profiles for each row execute function classic_private.sync_legacy_profile();
drop trigger if exists classic_sync_streak on public.game_streaks;
create trigger classic_sync_streak after insert or update on public.game_streaks for each row execute function classic_private.sync_legacy_streak();
drop trigger if exists classic_mirror_streak on classic_private.streaks;
create trigger classic_mirror_streak after insert or update on classic_private.streaks for each row execute function classic_private.sync_classic_streak();
revoke execute on all functions in schema classic_private from public,anon,authenticated;
notify pgrst, 'reload schema';

insert into classic_private.content(singleton,data) values(true,$catalog${"version":"classic-2026-10","words":["آباد","آزادی","آبان","آبشار","آبگیر","آبیاری","آبنبات","آسمان","آشکار","آفتاب","آفتابی","آفرین","آلبوم","آلودگی","آواز","آوازه","آویشن","آیینه","آهنگ","آهنگر","آهنین","اراده","ارزان","ارغوان","ارمغان","اردک","ارکیده","اساس","اسباب","اسبک","اسپند","استاد","استخر","استوار","اسفند","اشکال","اشتیاق","اشعار","اشکبار","اطراف","اعتبار","اعتدال","افتخار","افسانه","افسوس","افسون","افطار","افکار","اقامت","اقیانوس","اکنون","الوان","الماس","امید","امروز","امسال","امضا","انار","اندام","اندوه","اندیشه","انگشت","انگور","انگیزه","انسان","انصاف","اندازه","انجمن","انجیر","انبار","اندک","انرژی","ایوان","ایستگاه","ایمنی","بادام","بادبان","باران","بارانی","باریک","بازار","بازو","بازی","بازیگر","بافته","بالشت","بالش","بانگ","بامداد","باغچه","باغبان","باغستان","باهوش","بخشش","بخاری","بخار","بخیه","بدرود","بدنه","برادر","برفک","برفی","برگه","برگشت","برنج","برکت","برکه","برنا","برنامه","برنده","بریان","بلند","بلبل","بلور","بهار","بهاری","بهانه","بهبود","بهشت","بهمن","بهمنیار","بیدار","بیابان","بیشتر","بیمار","بینش","بینا","بیرون","بیلچه","بیست","بیقرار","پایدار","پاییز","پایان","پایه","پایانه","پاداش","پادشاه","پارچه","پارسا","پاره","پارو","پرنده","پرواز","پرچم","پرستو","پرگار","پرتو","پرورش","پرنیان","پروانه","پروین","پزشک","پدیده","پدربزرگ","پدرانه","پسته","پشتی","پنجره","پنجه","پندار","پنبه","پنیر","پناه","پنهان","پولاد","پولک","پوشاک","پوشش","پویا","پوست","پونه","پیاله","پیاز","پیشوا","پیشرو","پیمان","پیوند","پیروز","پیچک","پیدا","تابان","تابلو","تابش","تابستان","تابه","تاریک","تازگی","تاریخ","تخته","تخمیر","تندر","تندیس","تنور","تنفس","تنهایی","توان","توانگر","توانا","توتک","ترانه","ترسیم","ترمه","ترنج","ترازو","تکاپو","تکرار","تکلیف","تکیه","تیمار","تیغه","تیره","تیزرو","جاودان","جایزه","جاده","جادار","جامه","جانور","جاندار","جرقه","جستجو","جنگل","جنگجو","جوان","جوانه","جوانی","جوشان","جوهر","جویبار","جهان","جیوه","چادر","چارچوب","چاره","چاقو","چالاک","چشمه","چشمان","چشمک","چشمگیر","چغندر","چکامه","چکیده","چمنزار","چنار","چوبین","چهره","چینی","حباب","حریر","حساب","حسرت","حقیقت","حکایت","حکیم","حلقه","حلزون","حنجره","حیات","حیوان","خانه","خانگی","خاتون","خاطره","خواب","خوانا","خواندن","خواهر","خواست","خواسته","خبرگان","خجسته","خراش","خرداد","خردمند","خرما","خروش","خروشان","خرگوش","خرید","خستگی","خشخاش","خلوت","خلاق","خنده","خندان","خوراک","خورشید","خوشبو","خوشحال","خوشه","خیابان","خیال","خیار","دارا","دارو","داراب","دارچین","داور","داستان","دانه","دانش","دانا","دبستان","دبیر","دختر","درخت","درخشان","دریا","دریاچه","درمان","درنگ","دروازه","درویش","درون","درست","دریچه","دستور","دستمال","دستکش","دسته","دشتک","دشوار","دفتر","دقیقه","دلیر","دلاور","دلبند","دلنشین","دنیا","دوچرخه","دوران","دوربین","دوست","دوستی","دیوار","دیده","دیدار","دیروز","دیوان","دیگچه","راحت","راستی","راستگو","راهرو","راهنما","رایان","رایانه","رباب","ردیف","ردیاب","رزمنده","رنگین","رنگارنگ","رفاقت","رهبر","روستا","روشن","روشنی","روزانه","روزگار","روزنامه","روزنه","روبان","روباه","رودخانه","رویش","رویا","ریحان","ریگزار","ریشه","ریزان","زاگرس","زایش","زانو","زبرجد","زرافه","زرین","زرگر","زلال","زلزله","زمستان","زمان","زمین","زندگی","زنبور","زنجیر","زنده","زندان","زنگوله","زیتون","زیبا","زیبایی","زیور","ژاله","ژرفا","ژاکت","ساده","سادگی","سازنده","ساحل","سالاد","سامان","سایه","سایبان","سپاس","سپهر","سپیده","سپیدار","ستاره","ستایش","ستون","سحرگاه","سراب","سرآمد","سراچه","سراسر","سرباز","سرسبز","سرشت","سرما","سرود","سرور","سرمه","سرنشین","سرنوشت","سفره","سفال","سفید","سلامت","سلیقه","سنبل","سنجاب","سنگین","سنجش","سنگک","سوسن","سودمند","سوراخ","سوزان","سوزن","سوغات","سیاره","سیلاب","سیما","سیمین","سینه","سیمرغ","سیاه","شبانه","شبدر","شبنم","شتاب","شجاعت","شقایق","شکرانه","شکوفه","شکفته","شکلات","شگفت","شگرف","شمشاد","شماره","شمال","شمعک","شناور","شناس","شادی","شادان","شانه","شاهین","شاهد","شایان","شیشه","شیرین","شیرینی","شیوا","صابون","صنوبر","طاووس","طبیعت","طراوت","طلایی","طلوع","طنین","عاطفه","عروس","عطرآگین","عقیق","علاقه","علامت","عمارت","غروب","غزال","فاخته","فانوس","فراتر","فرجام","فردا","فردوس","فرزانه","فرزند","فرشته","فرمان","فرهنگ","فرصت","فریاد","فریبا","فضایی","فندق","فواره","فیروزه","قاصد","قاصدک","قاشق","قانون","قایق","قرمز","قرقره","قشنگ","قطار","قلاب","قلقک","قلمدان","قناری","قندیل","قنات","قهرمان","کاجستان","کاروان","کارنامه","کارگر","کاشف","کاسه","کاغذ","کابوس","کتاب","کتابچه","کبوتر","کدخدا","کرانه","کرسی","کرگدن","کشاورز","کشتی","کشمش","کفگیر","کفشدوز","کلاف","کلاهک","کلاغ","کلبه","کلام","کلید","کلیسا","کمان","کمانچه","کمربند","کنار","کنجد","کندو","کوچه","کودک","کوزه","کوکب","کولاک","کویر","کوهسار","کوهپایه","کیمیا","کیسه","گاری","گچکار","گرامی","گرداب","گردان","گردنه","گردو","گردونه","گرما","گرگان","گریان","گریبان","گلبرگ","گلدان","گلزار","گلستان","گلاب","گلابی","گلیم","گنبد","گنجشک","گوهر","گوارا","گوشه","گوجه","گوینده","گیاه","گیلاس","لاله","لادن","لبخند","لحاف","لحظه","لرزان","لشکر","لطافت","لقمه","لنگر","لواش","لوزی","لیوان","لیلاک","مادر","مادرانه","مارپیچ","ماهور","ماهی","ماهتاب","ماهر","ماشین","مالک","ماندگار","مانده","مجسمه","محفل","محبوب","محراب","مدرسه","مداد","مرجان","مرداب","مرداد","مروارید","مرهم","مزرعه","مسافر","مساحت","مسیر","مسجد","مشتاق","مشعل","مشکین","مطالعه","معادن","معمار","معدن","مفهوم","مقام","مقدمه","ملاقه","ملوان","ملکه","مناره","منزل","موشک","مورچه","موزون","موسیقی","موزه","مهارت","مهتاب","مهربان","مهرگان","میانه","میدان","میخک","نادر","نارنج","نازک","ناخدا","ناهار","نبرد","نجابت","نخود","نرگس","نرمش","نسیم","نشانه","نشاط","نگاه","نگار","نگران","نگین","نقاش","نقشه","نمناک","نمایش","نماد","نمونه","نواده","نوآور","نوازش","نوجوان","نوشتار","نوید","نهال","نهان","نیکی","نیاز","نیایش","نیلوفر","نیستان","نیمرخ","واژه","واژگان","واکسن","ورزش","ورودی","وسعت","وفادار","وقار","ویران","ویترین","ویرایش","هاله","هویت","هدیه","هراس","هزار","هزاره","هسته","هفته","هفتگی","هلال","همراه","همسایه","هموار","هنرور","هوادار","هوانورد","هویج","هیاهو","یاقوت","یادگار","یاری","یخچال","یگانه","یکسان","یکنواخت"],"colors":[{"name":"مرجان","hex":"#FF7168"},{"name":"زعفران","hex":"#F6B73C"},{"name":"کهربا","hex":"#D98E24"},{"name":"نارنگی","hex":"#FF943B"},{"name":"انار","hex":"#BC3042"},{"name":"تمشک","hex":"#D74275"},{"name":"شکوفه","hex":"#F4A6CB"},{"name":"آلبالو","hex":"#952B52"},{"name":"ارغوان","hex":"#AE53A0"},{"name":"یاس","hex":"#C5A3DE"},{"name":"اسطوخودوس","hex":"#9176D7"},{"name":"نیلی","hex":"#514EA3"},{"name":"لاجورد","hex":"#315AB5"},{"name":"اقیانوس","hex":"#147FBA"},{"name":"فیروزه","hex":"#2EBEB6"},{"name":"آسمان","hex":"#81C7EC"},{"name":"یخچال","hex":"#C1E8ED"},{"name":"نعناع","hex":"#90D9BB"},{"name":"پسته","hex":"#B8CD82"},{"name":"زیتون","hex":"#8C9C47"},{"name":"چمن","hex":"#63B44B"},{"name":"زمرد","hex":"#17866A"},{"name":"خزه","hex":"#6D8253"},{"name":"کاج","hex":"#294F42"},{"name":"موز","hex":"#F2DE73"},{"name":"عسل","hex":"#DBAD54"},{"name":"شنزار","hex":"#D5BC91"},{"name":"هلویی","hex":"#F8BD91"},{"name":"گلبهی","hex":"#E7A498"},{"name":"خاکی","hex":"#AD9278"},{"name":"کارامل","hex":"#B9814D"},{"name":"دارچین","hex":"#9F6041"},{"name":"قهوه","hex":"#70503C"},{"name":"کاکائو","hex":"#513B38"},{"name":"بادامی","hex":"#E2C8A7"},{"name":"شیری","hex":"#FFF3DA"},{"name":"صدفی","hex":"#E9E5DD"},{"name":"نقره","hex":"#BFC7D0"},{"name":"سنگی","hex":"#989F9D"},{"name":"دودی","hex":"#6C7883"},{"name":"زغالی","hex":"#39424C"},{"name":"شب","hex":"#22263F"},{"name":"یاقوت","hex":"#B43769"},{"name":"توت","hex":"#70559B"},{"name":"آبنبات","hex":"#F39CB7"},{"name":"بنفشه","hex":"#7553BB"},{"name":"مهتاب","hex":"#D1D2EA"},{"name":"دریا","hex":"#297A8B"},{"name":"باران","hex":"#9AB5C8"},{"name":"آووکادو","hex":"#7A9F5B"},{"name":"لیمو","hex":"#D7E65B"},{"name":"گل‌سرخ","hex":"#DE5167"},{"name":"خردلی","hex":"#C5A048"},{"name":"کدو","hex":"#DC7B3F"},{"name":"قند","hex":"#F4E9D1"},{"name":"بادمجان","hex":"#60416D"}],"countries":[{"id":"ir","name":"ایران","capital":"تهران","facts":["«تخت جمشید» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «میدان نقش جهان اصفهان» است."],"source":"https://whc.unesco.org/en/statesparties/ir/","otherCity":"اصفهان"},{"id":"fr","name":"فرانسه","capital":"پاریس","facts":["«کاخ ورسای» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «مون سن میشل» است."],"source":"https://whc.unesco.org/en/statesparties/fr/","otherCity":"مارسی"},{"id":"it","name":"ایتالیا","capital":"رم","facts":["«برج کج پیزا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر باستانی پمپئی» است."],"source":"https://whc.unesco.org/en/statesparties/it/","otherCity":"میلان"},{"id":"es","name":"اسپانیا","capital":"مادرید","facts":["«کاخ الحمرا در گرانادا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «آثار آنتونی گائودی در بارسلونا» است."],"source":"https://whc.unesco.org/en/statesparties/es/","otherCity":"بارسلونا"},{"id":"pt","name":"پرتغال","capital":"لیسبون","facts":["«برج بلم» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «منطقه تاریخی پورتو» است."],"source":"https://whc.unesco.org/en/statesparties/pt/","otherCity":"پورتو"},{"id":"de","name":"آلمان","capital":"برلین","facts":["«کلیسای جامع کلن» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کاخ‌های پوتسدام» است."],"source":"https://whc.unesco.org/en/statesparties/de/","otherCity":"مونیخ"},{"id":"at","name":"اتریش","capital":"وین","facts":["«کاخ شونبرون» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «مرکز تاریخی زالتسبورگ» است."],"source":"https://whc.unesco.org/en/statesparties/at/","otherCity":"سالزبورگ"},{"id":"ch","name":"سوئیس","capital":"برن","facts":["«شهر قدیمی برن» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «تاکستان‌های پلکانی لاوو» است."],"source":"https://whc.unesco.org/en/statesparties/ch/","otherCity":"زوریخ"},{"id":"nl","name":"هلند","capital":"آمستردام","facts":["«آسیاب‌های کیندردایک» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کانال‌های تاریخی آمستردام» است."],"source":"https://whc.unesco.org/en/statesparties/nl/","otherCity":"روتردام"},{"id":"be","name":"بلژیک","capital":"بروکسل","facts":["«میدان بزرگ بروکسل» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «مرکز تاریخی بروژ» است."],"source":"https://whc.unesco.org/en/statesparties/be/","otherCity":"آنتورپ"},{"id":"gb","name":"بریتانیا","capital":"لندن","facts":["«استون‌هنج» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «برج لندن» است."],"source":"https://whc.unesco.org/en/statesparties/gb/","otherCity":"منچستر"},{"id":"ie","name":"ایرلند","capital":"دوبلین","facts":["«محوطه باستانی برو نا بوینه» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «جزیره صخره‌ای اسکیلیگ مایکل» است."],"source":"https://whc.unesco.org/en/statesparties/ie/","otherCity":"کورک"},{"id":"dk","name":"دانمارک","capital":"کپنهاگ","facts":["«قلعه کرونبورگ» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کلیسای جامع روسکیله» است."],"source":"https://whc.unesco.org/en/statesparties/dk/","otherCity":"آرهوس"},{"id":"se","name":"سوئد","capital":"استکهلم","facts":["«کاخ دروتنینگهولم» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی ویسبی» است."],"source":"https://whc.unesco.org/en/statesparties/se/","otherCity":"گوتنبرگ"},{"id":"no","name":"نروژ","capital":"اسلو","facts":["«اسکله تاریخی بریگن» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کلیسای چوبی اورنس» است."],"source":"https://whc.unesco.org/en/statesparties/no/","otherCity":"برگن"},{"id":"fi","name":"فنلاند","capital":"هلسینکی","facts":["«دژ دریایی سومِنلینا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر قدیمی راوما» است."],"source":"https://whc.unesco.org/en/statesparties/fi/","otherCity":"تامپره"},{"id":"is","name":"ایسلند","capital":"ریکیاویک","facts":["«پارک ملی تینگولیر» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «جزیره آتشفشانی سورتسی» است."],"source":"https://whc.unesco.org/en/statesparties/is/","otherCity":"آکوریری"},{"id":"pl","name":"لهستان","capital":"ورشو","facts":["«مرکز تاریخی کراکوف» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «معدن نمک ویلیچکا» است."],"source":"https://whc.unesco.org/en/statesparties/pl/","otherCity":"کراکوف"},{"id":"cz","name":"چک","capital":"پراگ","facts":["«مرکز تاریخی پراگ» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی چسکی کروملوف» است."],"source":"https://whc.unesco.org/en/statesparties/cz/","otherCity":"برنو"},{"id":"hu","name":"مجارستان","capital":"بوداپست","facts":["«روستای تاریخی هولوکو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «غارهای آگتلک» است."],"source":"https://whc.unesco.org/en/statesparties/hu/","otherCity":"دبرتسن"},{"id":"ro","name":"رومانی","capital":"بخارست","facts":["«قلعه‌های داسی در کوه‌های اوراشتیه» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کلیساهای چوبی مارامورش» است."],"source":"https://whc.unesco.org/en/statesparties/ro/","otherCity":"کلوژ-ناپوکا"},{"id":"bg","name":"بلغارستان","capital":"صوفیه","facts":["«صومعه ریلا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «کلیسای بویانا» است."],"source":"https://whc.unesco.org/en/statesparties/bg/","otherCity":"وارنا"},{"id":"gr","name":"یونان","capital":"آتن","facts":["«آکروپولیس» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «محوطه باستانی دلفی» است."],"source":"https://whc.unesco.org/en/statesparties/gr/","otherCity":"تسالونیکی"},{"id":"hr","name":"کرواسی","capital":"زاگرب","facts":["«شهر قدیمی دوبروونیک» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی دریاچه‌های پلیتویتسه» است."],"source":"https://whc.unesco.org/en/statesparties/hr/","otherCity":"اسپلیت"},{"id":"si","name":"اسلوونی","capital":"لیوبلیانا","facts":["«غارهای شکوتسیان» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «معادن جیوه ایدریا» است."],"source":"https://whc.unesco.org/en/statesparties/si/","otherCity":"ماریبور"},{"id":"sk","name":"اسلواکی","capital":"براتیسلاوا","facts":["«قلعه اسپیش» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «روستای ولکولینتس» است."],"source":"https://whc.unesco.org/en/statesparties/sk/","otherCity":"کوشیتسه"},{"id":"rs","name":"صربستان","capital":"بلگراد","facts":["«صومعه استودنیتسا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «محوطه گامزیگراد» است."],"source":"https://whc.unesco.org/en/statesparties/rs/","otherCity":"نووی ساد"},{"id":"al","name":"آلبانی","capital":"تیرانا","facts":["«شهر باستانی بوترینت» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «مراکز تاریخی برات و جیروکاستر» است."],"source":"https://whc.unesco.org/en/statesparties/al/","otherCity":"دورس"},{"id":"ba","name":"بوسنی و هرزگوین","capital":"سارایوو","facts":["«پل قدیمی موستار» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پل محمد پاشا سوکولوویچ در ویشه‌گراد» است."],"source":"https://whc.unesco.org/en/statesparties/ba/","otherCity":"موستار"},{"id":"tr","name":"ترکیه","capital":"آنکارا","facts":["«محوطه باستانی گوبکلی‌تپه» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پاموک‌کاله» است."],"source":"https://whc.unesco.org/en/statesparties/tr/","otherCity":"استانبول"},{"id":"ge","name":"گرجستان","capital":"تفلیس","facts":["«صومعه گلاتی» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «منطقه تاریخی سوانتی علیا» است."],"source":"https://whc.unesco.org/en/statesparties/ge/","otherCity":"باتومی"},{"id":"am","name":"ارمنستان","capital":"ایروان","facts":["«صومعه گغارد» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «صومعه‌های هاغپات و ساناهین» است."],"source":"https://whc.unesco.org/en/statesparties/am/","otherCity":"گیومری"},{"id":"az","name":"جمهوری آذربایجان","capital":"باکو","facts":["«سنگ‌نگاره‌های قبوستان» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «برج دختر باکو» است."],"source":"https://whc.unesco.org/en/statesparties/az/","otherCity":"گنجه"},{"id":"jo","name":"اردن","capital":"امان","facts":["«شهر سنگی پترا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «بیابان وادی رم» است."],"source":"https://whc.unesco.org/en/statesparties/jo/","otherCity":"عقبه"},{"id":"lb","name":"لبنان","capital":"بیروت","facts":["«محوطه باستانی بعلبک» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی بیبلوس» است."],"source":"https://whc.unesco.org/en/statesparties/lb/","otherCity":"طرابلس"},{"id":"sa","name":"عربستان سعودی","capital":"ریاض","facts":["«محوطه باستانی حجر» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «محله طریف در درعیه» است."],"source":"https://whc.unesco.org/en/statesparties/sa/","otherCity":"جده"},{"id":"om","name":"عمان","capital":"مسقط","facts":["«قلعه بهلا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «سامانه‌های آبیاری افلاج» است."],"source":"https://whc.unesco.org/en/statesparties/om/","otherCity":"صلاله"},{"id":"ae","name":"امارات متحده عربی","capital":"ابوظبی","facts":["«محوطه‌های فرهنگی العین» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «واحه‌های ثبت‌شده العین» است."],"source":"https://whc.unesco.org/en/statesparties/ae/","otherCity":"دبی"},{"id":"bh","name":"بحرین","capital":"منامه","facts":["محوطه باستانی قلعه‌ای که پایتخت تمدن دیلمون بوده، در این کشور قرار دارد.","تپه‌های تدفین دیلمون از آثار ثبت‌شده این کشور هستند."],"source":"https://whc.unesco.org/en/statesparties/bh/","otherCity":"محرق"},{"id":"qa","name":"قطر","capital":"دوحه","facts":["محوطه باستانی شهر ساحلی الزباره در این کشور قرار دارد.","بقایای شهر تجاری الزباره در ساحل خلیج فارس، میراث جهانی این کشور است."],"source":"https://whc.unesco.org/en/statesparties/qa/","otherCity":"الخور"},{"id":"eg","name":"مصر","capital":"قاهره","facts":["«اهرام جیزه» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «معبدهای ابوسمبل» است."],"source":"https://whc.unesco.org/en/statesparties/eg/","otherCity":"اسکندریه"},{"id":"ma","name":"مراکش","capital":"رباط","facts":["«شهر تاریخی فاس» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «قصر آیت بن حدو» است."],"source":"https://whc.unesco.org/en/statesparties/ma/","otherCity":"کازابلانکا"},{"id":"tn","name":"تونس","capital":"تونس","facts":["«آمفی‌تئاتر الجم» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «بقایای شهر کارتاژ» است."],"source":"https://whc.unesco.org/en/statesparties/tn/","otherCity":"صفاقس"},{"id":"dz","name":"الجزایر","capital":"الجزیره","facts":["«شهر باستانی تیمگاد» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «قصبه الجزیره» است."],"source":"https://whc.unesco.org/en/statesparties/dz/","otherCity":"وهران"},{"id":"et","name":"اتیوپی","capital":"آدیس آبابا","facts":["«کلیساهای سنگی لالیبلا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر باستانی اکسوم» است."],"source":"https://whc.unesco.org/en/statesparties/et/","otherCity":"گوندَر"},{"id":"ke","name":"کنیا","capital":"نایروبی","facts":["«شهر قدیمی لامو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی کوه کنیا» است."],"source":"https://whc.unesco.org/en/statesparties/ke/","otherCity":"مومباسا"},{"id":"tz","name":"تانزانیا","capital":"دودوما","facts":["«پارک ملی سرنگتی» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی کلیمانجارو» است."],"source":"https://whc.unesco.org/en/statesparties/tz/","otherCity":"دارالسلام"},{"id":"za","name":"آفریقای جنوبی","capital":"پرتوریا","facts":["«جزیره روبن» در این کشور قرار دارد.","محوطه‌های فسیلی استرک‌فونتین از میراث جهانی این کشور هستند."],"source":"https://whc.unesco.org/en/statesparties/za/","otherCity":"ژوهانسبورگ"},{"id":"in","name":"هند","capital":"دهلی نو","facts":["«تاج محل» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «قلعه سرخ دهلی» است."],"source":"https://whc.unesco.org/en/statesparties/in/","otherCity":"بمبئی"},{"id":"pk","name":"پاکستان","capital":"اسلام‌آباد","facts":["«شهر باستانی موهنجودارو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «باغ‌های شالیمار لاهور» است."],"source":"https://whc.unesco.org/en/statesparties/pk/","otherCity":"کراچی"},{"id":"np","name":"نپال","capital":"کاتماندو","facts":["«لومبینی، زادگاه بودا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی ساگارماتا» است."],"source":"https://whc.unesco.org/en/statesparties/np/","otherCity":"پوخارا"},{"id":"lk","name":"سریلانکا","capital":"سری جایاواردنپورا کوته","facts":["«دژ سنگی سیگیریا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی آنوراداپورا» است."],"source":"https://whc.unesco.org/en/statesparties/lk/","otherCity":"کندی"},{"id":"bd","name":"بنگلادش","capital":"داکا","facts":["«شهر مسجدهای باگرهات» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «ویرانه‌های صومعه پاهارپور» است."],"source":"https://whc.unesco.org/en/statesparties/bd/","otherCity":"چیتاگونگ"},{"id":"cn","name":"چین","capital":"پکن","facts":["«دیوار بزرگ» با برج‌های دیده‌بانی فراوان، از دیدنی‌های تاریخی این کشور است.","ارتش سربازان سفالی در آرامگاه نخستین امپراتور این کشور کشف شده است."],"source":"https://whc.unesco.org/en/statesparties/cn/","otherCity":"شانگهای"},{"id":"jp","name":"ژاپن","capital":"توکیو","facts":["«کوه فوجی» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «قلعه هیمه‌جی» است."],"source":"https://whc.unesco.org/en/statesparties/jp/","otherCity":"اوساکا"},{"id":"kr","name":"کره جنوبی","capital":"سئول","facts":["«کاخ چانگ‌دوک» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «معبد بولگوکسا» است."],"source":"https://whc.unesco.org/en/statesparties/kr/","otherCity":"بوسان"},{"id":"th","name":"تایلند","capital":"بانکوک","facts":["«شهر تاریخی آیوتایا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی سوکوتای» است."],"source":"https://whc.unesco.org/en/statesparties/th/","otherCity":"چیانگ مای"},{"id":"kh","name":"کامبوج","capital":"پنوم‌پن","facts":["«معبدهای انگکور» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «معبد پره ویهار» است."],"source":"https://whc.unesco.org/en/statesparties/kh/","otherCity":"سیم ریپ"},{"id":"vn","name":"ویتنام","capital":"هانوی","facts":["«خلیج هالونگ» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی هوی‌آن» است."],"source":"https://whc.unesco.org/en/statesparties/vn/","otherCity":"هوشی‌مین"},{"id":"id","name":"اندونزی","capital":"جاکارتا","facts":["«معبد بوروبودور» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی کومودو» است."],"source":"https://whc.unesco.org/en/statesparties/id/","otherCity":"سورابایا"},{"id":"my","name":"مالزی","capital":"کوالالامپور","facts":["«پارک ملی کینابالو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی گونونگ مولو» است."],"source":"https://whc.unesco.org/en/statesparties/my/","otherCity":"جرج تاون"},{"id":"ph","name":"فیلیپین","capital":"مانیل","facts":["«شالیزارهای پلکانی کوردیلرا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر تاریخی ویگان» است."],"source":"https://whc.unesco.org/en/statesparties/ph/","otherCity":"سبو"},{"id":"au","name":"استرالیا","capital":"کانبرا","facts":["«دیوار بزرگ مرجانی» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «خانه اپرای سیدنی» است."],"source":"https://whc.unesco.org/en/statesparties/au/","otherCity":"سیدنی"},{"id":"nz","name":"نیوزیلند","capital":"ولینگتون","facts":["پارک ملی تونگاریرو در این کشور قرار دارد.","جزایر زیرجنوبگان این کشور در فهرست میراث جهانی ثبت شده‌اند."],"source":"https://whc.unesco.org/en/statesparties/nz/","otherCity":"اوکلند"},{"id":"ca","name":"کانادا","capital":"اتاوا","facts":["«پارک ملی بنف» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر قدیمی کبک» است."],"source":"https://whc.unesco.org/en/statesparties/ca/","otherCity":"تورنتو"},{"id":"us","name":"ایالات متحده آمریکا","capital":"واشینگتن","facts":["«پارک ملی یلواستون» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «مجسمه آزادی» است."],"source":"https://whc.unesco.org/en/statesparties/us/","otherCity":"نیویورک"},{"id":"mx","name":"مکزیک","capital":"مکزیکوسیتی","facts":["«شهر باستانی چیچن ایتزا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «شهر باستانی تئوتیئواکان» است."],"source":"https://whc.unesco.org/en/statesparties/mx/","otherCity":"گوادالاخارا"},{"id":"br","name":"برزیل","capital":"برازیلیا","facts":["«شهر تاریخی اورو پرتو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک ملی ایگواسو» است."],"source":"https://whc.unesco.org/en/statesparties/br/","otherCity":"ریو دو ژانیرو"},{"id":"ar","name":"آرژانتین","capital":"بوئنوس آیرس","facts":["«پارک ملی لوس گلاسیارس» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «غار دست‌ها در ریو پینتوراس» است."],"source":"https://whc.unesco.org/en/statesparties/ar/","otherCity":"کوردوبا"},{"id":"pe","name":"پرو","capital":"لیما","facts":["«شهر باستانی ماچو پیچو» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «خطوط نازکا» است."],"source":"https://whc.unesco.org/en/statesparties/pe/","otherCity":"کوسکو"},{"id":"cl","name":"شیلی","capital":"سانتیاگو","facts":["«پارک ملی راپا نویی» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «محله تاریخی بندر والپارایسو» است."],"source":"https://whc.unesco.org/en/statesparties/cl/","otherCity":"والپارایسو"},{"id":"co","name":"کلمبیا","capital":"بوگوتا","facts":["«بندر تاریخی کارتاخنا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «پارک باستان‌شناسی سن آگوستین» است."],"source":"https://whc.unesco.org/en/statesparties/co/","otherCity":"مدئین"},{"id":"cu","name":"کوبا","capital":"هاوانا","facts":["«مرکز تاریخی هاوانا» در این کشور قرار دارد.","یکی از دیدنی‌های ثبت‌شده این کشور در فهرست میراث جهانی، «دره وینیالس» است."],"source":"https://whc.unesco.org/en/statesparties/cu/","otherCity":"سانتیاگو د کوبا"}],"crosswords":[{"id":1,"title":"بوی باران","cost":1000,"rows":5,"cols":5,"blackCells":[[1,1],[1,2],[1,3],[1,4],[2,3],[2,4],[3,1],[3,2],[3,3],[3,4],[4,4]],"slots":[{"number":1,"direction":"down","row":0,"col":0,"word":"باران","clue":"قطره‌هایی که از ابر می‌بارند"},{"number":1,"direction":"across","row":0,"col":0,"word":"باغچه","clue":"باغ کوچک کنار خانه"},{"number":2,"direction":"across","row":2,"col":0,"word":"رنگ","clue":"آنچه قرمز و آبی نمونه‌های آن هستند"},{"number":3,"direction":"across","row":4,"col":0,"word":"نسیم","clue":"باد ملایم و خوشایند"}]},{"id":2,"title":"آبی آرام","cost":1000,"rows":4,"cols":5,"blackCells":[[1,1],[1,2],[1,3],[1,4],[2,3],[2,4],[3,1],[3,2],[3,3],[3,4]],"slots":[{"number":1,"direction":"down","row":0,"col":0,"word":"دریا","clue":"پهنه بزرگ آب شور"},{"number":1,"direction":"across","row":0,"col":0,"word":"دلفین","clue":"پستاندار دریایی بازیگوش و باهوش"},{"number":2,"direction":"across","row":2,"col":0,"word":"یاس","clue":"گل خوشبوی سفید"}]},{"id":3,"title":"شب روشن","cost":1000,"rows":5,"cols":4,"blackCells":[[1,1],[1,2],[1,3],[3,1],[3,2],[3,3],[4,3]],"slots":[{"number":1,"direction":"down","row":0,"col":0,"word":"ستاره","clue":"چراغ درخشان آسمان شب"},{"number":1,"direction":"across","row":0,"col":0,"word":"سلام","clue":"واژه آغاز دیدار"},{"number":2,"direction":"across","row":2,"col":0,"word":"امید","clue":"انتظار خوب برای آینده"},{"number":3,"direction":"across","row":4,"col":0,"word":"هوا","clue":"آنچه نفس می‌کشیم"}]},{"id":4,"title":"پرواز کلمات","cost":1000,"rows":5,"cols":4,"blackCells":[[1,1],[1,2],[1,3],[3,1],[3,2],[3,3],[4,3]],"slots":[{"number":1,"direction":"down","row":0,"col":0,"word":"کبوتر","clue":"پرنده‌ای آشنا با نماد صلح"},{"number":1,"direction":"across","row":0,"col":0,"word":"کتاب","clue":"دوست کاغذی اهل مطالعه"},{"number":2,"direction":"across","row":2,"col":0,"word":"ورزش","clue":"فعالیت بدنی برای تندرستی"},{"number":3,"direction":"across","row":4,"col":0,"word":"رود","clue":"جریان آب روان در طبیعت"}]}],"chords":[{"name":"ماژور 45","notes":[45,49,52]},{"name":"مینور 45","notes":[45,48,52]},{"name":"ساس 45","notes":[45,50,52]},{"name":"هفتم 45","notes":[45,49,52,55]},{"name":"ماژور 50","notes":[50,54,57]},{"name":"مینور 50","notes":[50,53,57]},{"name":"ساس 50","notes":[50,55,57]},{"name":"هفتم 50","notes":[50,54,57,60]},{"name":"ماژور 55","notes":[55,59,62]},{"name":"مینور 55","notes":[55,58,62]},{"name":"ساس 55","notes":[55,60,62]},{"name":"هفتم 55","notes":[55,59,62,65]},{"name":"ماژور 60","notes":[60,64,67]},{"name":"مینور 60","notes":[60,63,67]},{"name":"ساس 60","notes":[60,65,67]},{"name":"هفتم 60","notes":[60,64,67,70]},{"name":"ماژور 65","notes":[65,69,72]},{"name":"مینور 65","notes":[65,68,72]},{"name":"ساس 65","notes":[65,70,72]},{"name":"هفتم 65","notes":[65,69,72,75]},{"name":"ماژور 70","notes":[70,74,77]},{"name":"مینور 70","notes":[70,73,77]},{"name":"ساس 70","notes":[70,75,77]},{"name":"هفتم 70","notes":[70,74,77,80]},{"name":"ماژور 75","notes":[75,79,82]},{"name":"مینور 75","notes":[75,78,82]},{"name":"ساس 75","notes":[75,80,82]},{"name":"هفتم 75","notes":[75,79,82,85]},{"name":"ماژور 80","notes":[80,84,87]},{"name":"مینور 80","notes":[80,83,87]},{"name":"ساس 80","notes":[80,85,87]},{"name":"هفتم 80","notes":[80,84,87,90]}],"memory":{"ranges":[[0,99],[100,999]],"targets":5,"choices":15}}$catalog$::jsonb) on conflict(singleton) do update set data=excluded.data;
commit;
