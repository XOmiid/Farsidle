-- Private, receive-only room notifications. Polling remains a fallback.
DO $policy$ BEGIN
 if to_regclass('realtime.messages')is not null then
  execute 'drop policy if exists galactic_members_receive on realtime.messages';
  execute 'create policy galactic_members_receive on realtime.messages for select to authenticated using (public.galactic_can_watch((select realtime.topic())))';
 end if;
END $policy$;
