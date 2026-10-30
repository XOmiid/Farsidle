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
