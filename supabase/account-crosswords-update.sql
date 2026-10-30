-- Additive update; keeps old crossword content and purchases intact.
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
 if p_game='crossword' and p_id is null then select data#>>'{crosswords,0,id}' into p_id from classic_private.content where singleton;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 perform public.classic_get(p_game,p_id);
 v_key:=case when p_game='crossword' then 'crossword:'||p_id else v_day||':'||p_game end;
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
declare v_uid uuid:=classic_private.ensure_player();p classic_private.players%rowtype;results jsonb;streaks jsonb;claim text;v_birth date;v_country text;
begin
 perform classic_private.settle_teams();select * into p from classic_private.players where id=v_uid;
 select coalesce(jsonb_agg(jsonb_build_object('game',state->>'game','date',state->>'date','score',state->'score','max',state->'max','won',state->'won') order by updated_at),'[]'::jsonb) into results from (select state,updated_at from classic_private.games where user_id=v_uid and (state->>'finished')::boolean order by updated_at desc limit 120)t;
 select coalesce(jsonb_object_agg(game,jsonb_build_object('date',day,'count',case when day>=(classic_private.game_day()::date-1)::text then count else 0 end)),'{}'::jsonb) into streaks from classic_private.streaks where user_id=v_uid;
 select max(day) into claim from classic_private.coins where user_id=v_uid and source='daily_login';
 select birth_date,country into v_birth,v_country from public.profiles where id=v_uid;
 return jsonb_build_object('birthDate',v_birth,'country',v_country,'name',p.name,'avatar',p.avatar,'balance',classic_private.balance(v_uid),'claim',claim,'local',false,'streaks',streaks,'results',results);
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
-- Three-argument endpoint adds optional private details; the old two-argument
-- endpoint remains available so the currently deployed client keeps working.
create or replace function public.classic_update_profile(p_name text,p_avatar text,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=classic_private.ensure_player();v_birth date;v_country text;
begin
 if p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'اطلاعات حساب معتبر نیست.';end if;
 v_birth:=nullif(p_details->>'birthDate','')::date;v_country:=nullif(trim(p_details->>'country'),'');
 if v_birth is not null and (v_birth<date '1900-01-01' or v_birth>current_date) then raise exception 'تاریخ تولد معتبر نیست.';end if;
 if v_country is not null and (char_length(v_country)>80 or v_country~'[<>[:cntrl:]]') then raise exception 'نام کشور معتبر نیست.';end if;
 perform public.classic_update_profile(p_name,p_avatar);
 update public.profiles set birth_date=v_birth,country=v_country where id=v_uid;
 exception when invalid_datetime_format or datetime_field_overflow then raise exception 'تاریخ تولد معتبر نیست.';
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
revoke execute on function public.classic_update_profile(text,text,jsonb) from public,anon;
revoke execute on function public.classic_claim() from public,anon;
revoke execute on function public.classic_leaderboard(text) from public;
grant execute on function public.classic_get(text,text),public.classic_act(text,jsonb,text),public.classic_profile(),public.classic_update_profile(text,text),public.classic_update_profile(text,text,jsonb),public.classic_claim() to authenticated;
grant execute on function public.classic_leaderboard(text) to anon,authenticated;
-- Content insertion and COMMIT are appended by npm run db:prepare.

-- Birth date and residence are private account details, not public profile columns.
revoke select on public.profiles from public,anon,authenticated;
grant select(id,username,avatar,leaderboard_restricted) on public.profiles to anon,authenticated;

update classic_private.content set data=jsonb_set(data,'{crosswords}',$minis$[{"id": 101, "title": "مینی‌جدول ۱", "cost": 1000, "rows": 5, "cols": 5, "blackCells": [[0, 0], [0, 1], [1, 0], [3, 4], [4, 3], [4, 4]], "slots": [{"number": 1, "direction": "across", "row": 0, "col": 2, "word": "دزد", "clue": "کسی که مال دیگران را پنهانی می‌برد"}, {"number": 4, "direction": "across", "row": 1, "col": 1, "word": "سیاه", "clue": "رنگ مقابل سفید"}, {"number": 5, "direction": "across", "row": 2, "col": 0, "word": "پروین", "clue": "نام کوچک اعتصامی، شاعر ایرانی"}, {"number": 6, "direction": "across", "row": 3, "col": 0, "word": "لواش", "clue": "نان نازک و پهن"}, {"number": 7, "direction": "across", "row": 4, "col": 0, "word": "کدر", "clue": "نه شفاف و نه زلال"}, {"number": 1, "direction": "down", "row": 0, "col": 2, "word": "دیوار", "clue": "جداکنندهٔ عمودی میان دو اتاق"}, {"number": 2, "direction": "down", "row": 0, "col": 3, "word": "زایش", "clue": "به دنیا آمدن؛ تولد"}, {"number": 3, "direction": "down", "row": 0, "col": 4, "word": "دهن", "clue": "صورت گفتاریِ «دهان»"}, {"number": 4, "direction": "down", "row": 1, "col": 1, "word": "سرود", "clue": "آواز دسته‌جمعی، مانند نوع ملی آن"}, {"number": 5, "direction": "down", "row": 2, "col": 0, "word": "پلک", "clue": "پوشش متحرک روی چشم"}]}, {"id": 102, "title": "مینی‌جدول ۲", "cost": 1000, "rows": 5, "cols": 5, "blackCells": [[0, 0], [0, 1], [1, 0], [3, 4], [4, 3], [4, 4]], "slots": [{"number": 1, "direction": "across", "row": 0, "col": 2, "word": "پند", "clue": "اندرز و نصیحت"}, {"number": 4, "direction": "across", "row": 1, "col": 1, "word": "جوهر", "clue": "مایعی که در خودنویس می‌ریزند"}, {"number": 5, "direction": "across", "row": 2, "col": 0, "word": "چالاک", "clue": "تند و فرز در حرکت"}, {"number": 6, "direction": "across", "row": 3, "col": 0, "word": "کمان", "clue": "وسیله‌ای برای پرتاب تیر"}, {"number": 7, "direction": "across", "row": 4, "col": 0, "word": "شهد", "clue": "مایع شیرینی که زنبور از گل می‌گیرد"}, {"number": 1, "direction": "down", "row": 0, "col": 2, "word": "پولاد", "clue": "نام دیگر فولاد"}, {"number": 2, "direction": "down", "row": 0, "col": 3, "word": "نهان", "clue": "پنهان؛ دور از دید"}, {"number": 3, "direction": "down", "row": 0, "col": 4, "word": "درک", "clue": "فهمیدن و دریافتن"}, {"number": 4, "direction": "down", "row": 1, "col": 1, "word": "جامه", "clue": "لباس؛ پوشاک"}, {"number": 5, "direction": "down", "row": 2, "col": 0, "word": "چکش", "clue": "ابزاری برای کوبیدن میخ"}]}, {"id": 103, "title": "مینی‌جدول ۳", "cost": 1000, "rows": 5, "cols": 5, "blackCells": [[0, 0], [0, 1], [1, 0], [3, 4], [4, 3], [4, 4]], "slots": [{"number": 1, "direction": "across", "row": 0, "col": 2, "word": "منع", "clue": "جلوگیری و بازداشتن از کاری"}, {"number": 4, "direction": "across", "row": 1, "col": 1, "word": "خرید", "clue": "گرفتن کالا در برابر پرداخت پول"}, {"number": 5, "direction": "across", "row": 2, "col": 0, "word": "خرداد", "clue": "سومین ماه سال خورشیدی"}, {"number": 6, "direction": "across", "row": 3, "col": 0, "word": "آواز", "clue": "صدای آهنگین انسان هنگام خواندن"}, {"number": 7, "direction": "across", "row": 4, "col": 0, "word": "رشد", "clue": "بزرگ‌تر شدن و بالیدن"}, {"number": 1, "direction": "down", "row": 0, "col": 2, "word": "مرداد", "clue": "پنجمین ماه سال خورشیدی"}, {"number": 2, "direction": "down", "row": 0, "col": 3, "word": "نیاز", "clue": "احتیاج به چیزی"}, {"number": 3, "direction": "down", "row": 0, "col": 4, "word": "عدد", "clue": "آنچه برای شمردن به کار می‌بریم"}, {"number": 4, "direction": "down", "row": 1, "col": 1, "word": "خروش", "clue": "فریاد بلند؛ بانگ پرهیاهو"}, {"number": 5, "direction": "down", "row": 2, "col": 0, "word": "خار", "clue": "نوک تیز روی ساقهٔ برخی گیاهان"}]}, {"id": 1, "title": "بوی باران", "cost": 1000, "rows": 5, "cols": 5, "blackCells": [[1, 1], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4], [4, 4]], "slots": [{"number": 1, "direction": "down", "row": 0, "col": 0, "word": "باران", "clue": "قطره‌هایی که از ابر می‌بارند"}, {"number": 1, "direction": "across", "row": 0, "col": 0, "word": "باغچه", "clue": "باغ کوچک کنار خانه"}, {"number": 2, "direction": "across", "row": 2, "col": 0, "word": "رنگ", "clue": "آنچه قرمز و آبی نمونه‌های آن هستند"}, {"number": 3, "direction": "across", "row": 4, "col": 0, "word": "نسیم", "clue": "باد ملایم و خوشایند"}]}, {"id": 2, "title": "آبی آرام", "cost": 1000, "rows": 4, "cols": 5, "blackCells": [[1, 1], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4]], "slots": [{"number": 1, "direction": "down", "row": 0, "col": 0, "word": "دریا", "clue": "پهنه بزرگ آب شور"}, {"number": 1, "direction": "across", "row": 0, "col": 0, "word": "دلفین", "clue": "پستاندار دریایی بازیگوش و باهوش"}, {"number": 2, "direction": "across", "row": 2, "col": 0, "word": "یاس", "clue": "گل خوشبوی سفید"}]}, {"id": 3, "title": "شب روشن", "cost": 1000, "rows": 5, "cols": 4, "blackCells": [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3], [4, 3]], "slots": [{"number": 1, "direction": "down", "row": 0, "col": 0, "word": "ستاره", "clue": "چراغ درخشان آسمان شب"}, {"number": 1, "direction": "across", "row": 0, "col": 0, "word": "سلام", "clue": "واژه آغاز دیدار"}, {"number": 2, "direction": "across", "row": 2, "col": 0, "word": "امید", "clue": "انتظار خوب برای آینده"}, {"number": 3, "direction": "across", "row": 4, "col": 0, "word": "هوا", "clue": "آنچه نفس می‌کشیم"}]}, {"id": 4, "title": "پرواز کلمات", "cost": 1000, "rows": 5, "cols": 4, "blackCells": [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3], [4, 3]], "slots": [{"number": 1, "direction": "down", "row": 0, "col": 0, "word": "کبوتر", "clue": "پرنده‌ای آشنا با نماد صلح"}, {"number": 1, "direction": "across", "row": 0, "col": 0, "word": "کتاب", "clue": "دوست کاغذی اهل مطالعه"}, {"number": 2, "direction": "across", "row": 2, "col": 0, "word": "ورزش", "clue": "فعالیت بدنی برای تندرستی"}, {"number": 3, "direction": "across", "row": 4, "col": 0, "word": "رود", "clue": "جریان آب روان در طبیعت"}]}]$minis$::jsonb) where singleton;
notify pgrst, 'reload schema';
