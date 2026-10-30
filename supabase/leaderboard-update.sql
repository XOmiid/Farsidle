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

revoke execute on function public.classic_leaderboard(text) from public;
grant execute on function public.classic_leaderboard(text) to anon,authenticated;
notify pgrst, 'reload schema';
