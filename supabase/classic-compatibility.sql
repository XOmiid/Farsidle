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
