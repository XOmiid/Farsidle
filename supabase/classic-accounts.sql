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
 select jsonb_build_object('name',p.name,'avatar',p.avatar,'score',g.state->'score','max',g.state->'max','won',coalesce((g.state->>'won')::boolean,false),'submittedAt',g.updated_at,'self',coalesce(p.id=auth.uid(),false),'team',t.team,'pending',case when t.user_id is null then false else not exists(select 1 from classic_private.teams other where other.day=t.day and other.slot=t.slot and other.team<>t.team and other.score is not null) end) as entry,
 row_number() over(order by case when p_game='wordle' then case when (g.state->>'won')::boolean then 1 else 0 end else (g.state->>'score')::numeric end desc,g.updated_at,g.user_id) as rank_no
 from classic_private.games g join classic_private.players p on p.id=g.user_id
 left join classic_private.teams t on p_game='teamdle' and t.day=v_day and t.user_id=g.user_id
 where g.game_key=v_day||':'||p_game and (g.state->>'finished')::boolean and not p.restricted

 order by rank_no limit case when p_game='teamdle' then null else 50 end)q;
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
