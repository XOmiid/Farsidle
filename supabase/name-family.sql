create schema if not exists name_family;
revoke all on schema name_family from public, anon, authenticated;

create table if not exists name_family.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host uuid not null references auth.users (id) on delete cascade,
  title text not null,
  is_public boolean not null default false,
  capacity int not null check (capacity between 2 and 8),
  categories jsonb not null,
  rounds_total int not null check (rounds_total between 1 and 20),
  round_seconds int not null check (round_seconds in (0, 30, 45, 60, 90, 120)),
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'review', 'finished')),
  round_no int not null default 0,
  category_no int not null default 0,
  letters jsonb not null default '[]',
  deadline timestamptz,
  stop_deadline timestamptz,
  review_deadline timestamptz,
  created_at timestamptz not null default now()
);
alter table name_family.rooms add column if not exists category_no int not null default 0;
alter table name_family.rooms add column if not exists stop_deadline timestamptz;

create table if not exists name_family.members (
  room_id uuid not null references name_family.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists name_family.entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references name_family.rooms (id) on delete cascade,
  round_no int not null,
  user_id uuid not null,
  category text not null,
  value text not null default '',
  votes jsonb not null default '{}',
  reviewed boolean not null default false,
  valid boolean,
  points int not null default 0,
  unique (room_id, round_no, user_id, category),
  foreign key (room_id, user_id) references name_family.members (room_id, user_id) on delete cascade
);

create index if not exists name_family_entries_review_idx
  on name_family.entries (room_id, round_no, reviewed);
create index if not exists name_family_entries_room_user_idx
  on name_family.entries (room_id, user_id);
create index if not exists name_family_members_user_idx
  on name_family.members (user_id);
create index if not exists name_family_rooms_host_idx
  on name_family.rooms (host);

alter table name_family.rooms enable row level security;
alter table name_family.members enable row level security;
alter table name_family.entries enable row level security;

create or replace function public.name_family_create(
  p_title text,
  p_public boolean,
  p_capacity int,
  p_categories jsonb,
  p_rounds int,
  p_seconds int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  rid uuid;
  room_code text;
  nm text;
begin
  if u is null then raise exception 'برای بازی وارد حساب شوید.'; end if;
  if p_capacity not between 2 and 8
     or p_rounds not between 1 and 20
     or p_seconds not in (0, 30, 45, 60, 90, 120)
     or nullif(trim(p_title), '') is null then
    raise exception 'تنظیمات اتاق معتبر نیست.';
  end if;
  if coalesce(jsonb_typeof(p_categories), '') <> 'array' then
    raise exception 'دسته‌بندی‌های اتاق معتبر نیست.';
  end if;
  if jsonb_array_length(p_categories) not between 4 and 16
     or (select count(distinct category) from jsonb_array_elements_text(p_categories) as c(category)) <> jsonb_array_length(p_categories)
     or exists (
       select 1 from jsonb_array_elements_text(p_categories) as c(category)
       where category not in ('اسم','فامیل','رنگ','غذا','حیوان','کشور','شهر','ماشین','اشیا','میوه','گل','شغل','ورزش','فیلم','اعضای بدن','لباس')
     ) then
    raise exception 'دسته‌بندی‌های انتخاب‌شده معتبر نیستند.';
  end if;
  select coalesce(username, 'بازیکن') into nm from public.profiles where id = u;
  room_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into name_family.rooms (code, host, title, is_public, capacity, categories, rounds_total, round_seconds)
  values (room_code, u, left(trim(p_title), 40), p_public, p_capacity, p_categories, p_rounds, p_seconds)
  returning id into rid;
  insert into name_family.members values (rid, u, nm, now());
  return public.name_family_room(room_code);
end
$$;

create or replace function public.name_family_join(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  rid uuid;
  cap int;
  nm text;
begin
  if u is null then raise exception 'برای بازی وارد حساب شوید.'; end if;
  select id, capacity into rid, cap
  from name_family.rooms
  where code = upper(trim(p_code)) and phase = 'lobby'
  for update;
  if rid is null then raise exception 'اتاق پیدا نشد یا بازی شروع شده است.'; end if;
  if not exists (select 1 from name_family.members where room_id = rid and user_id = u) then
    if (select count(*) from name_family.members where room_id = rid) >= cap then
      raise exception 'ظرفیت اتاق تکمیل است.';
    end if;
    select coalesce(username, 'بازیکن') into nm from public.profiles where id = u;
    insert into name_family.members values (rid, u, nm, now());
  end if;
  return public.name_family_room(upper(trim(p_code)));
end
$$;

create or replace function name_family.close_expired_round(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r name_family.rooms%rowtype;
begin
  select * into r from name_family.rooms where id = p_room_id;
  if r.id is null or r.phase <> 'playing' then return; end if;
  if r.stop_deadline is not null then
    if r.stop_deadline > clock_timestamp() then return; end if;
  elsif r.deadline is null or r.deadline > clock_timestamp() then
    return;
  end if;

  select * into r from name_family.rooms where id = p_room_id for update;
  if r.id is null or r.phase <> 'playing' then return; end if;
  if r.stop_deadline is not null then
    if r.stop_deadline > clock_timestamp() then return; end if;
  elsif r.deadline is null or r.deadline > clock_timestamp() then
    return;
  end if;

  insert into name_family.entries (room_id, round_no, user_id, category, value)
  select r.id, r.round_no, m.user_id, c.category, ''
  from name_family.members m
  cross join lateral jsonb_array_elements_text(r.categories) as c(category)
  where m.room_id = r.id
  on conflict do nothing;

  update name_family.rooms
  set phase = 'review', deadline = null, stop_deadline = null,
      review_deadline = clock_timestamp() + interval '2 minutes', category_no = 0
  where id = r.id;
  update name_family.entries
  set reviewed = true, valid = false
  where room_id = r.id and round_no = r.round_no and value = '';
end
$$;

create or replace function public.name_family_room(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r name_family.rooms%rowtype;
  result jsonb;
begin
  select * into r from name_family.rooms where code = upper(trim(p_code));
  if r.id is null or not exists (
    select 1 from name_family.members where room_id = r.id and user_id = u
  ) then
    raise exception 'عضو این اتاق نیستید.';
  end if;
  perform name_family.close_expired_round(r.id);
  select * into r from name_family.rooms where id = r.id;

  select jsonb_build_object(
    'id', r.id,
    'self', u,
    'code', r.code,
    'title', r.title,
    'public', r.is_public,
    'host', r.host = u,
    'phase', r.phase,
    'capacity', r.capacity,
    'categories', r.categories,
    'rounds', r.rounds_total,
    'roundSeconds', r.round_seconds,
    'round', r.round_no,
    'categoryNo', r.category_no,
    'category', r.categories ->> r.category_no,
    'letter', r.letters ->> (r.round_no - 1),
    'deadline', r.deadline,
    'stopDeadline', r.stop_deadline,
    'reviewDeadline', r.review_deadline,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.user_id,
        'name', m.display_name,
        'score', coalesce((
          select sum(e.points) from name_family.entries e
          where e.room_id = r.id and e.user_id = m.user_id
        ), 0)
      ) order by m.joined_at), '[]')
      from name_family.members m where m.room_id = r.id
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'round', e.round_no,
        'user', e.user_id,
        'name', m.display_name,
        'category', e.category,
        'value', e.value,
        'votes', e.votes,
        'reviewed', e.reviewed,
        'valid', e.valid,
        'points', e.points
      ) order by array_position(array(select jsonb_array_elements_text(r.categories)), e.category), m.joined_at), '[]')
      from name_family.entries e
      join name_family.members m on m.room_id = e.room_id and m.user_id = e.user_id
      where e.room_id = r.id and e.round_no = r.round_no
        and (r.phase <> 'playing' or e.user_id = u)
        and (r.phase <> 'review' or e.category = r.categories ->> r.category_no)
    ),
    'serverNow', floor(extract(epoch from clock_timestamp()) * 1000)
  ) into result;
  return result;
end
$$;

create or replace function public.name_family_act(p_code text, p_action jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r name_family.rooms%rowtype;
  cat text;
  letter text;
  v text;
  entry_id uuid;
  yes_count int;
  vote_count int;
  eligible int;
  is_valid boolean;
  filled int;
  same_count int;
begin
  if u is null then raise exception 'برای بازی وارد حساب شوید.'; end if;
  select * into r from name_family.rooms where code = upper(trim(p_code)) for update;
  if r.id is null or not exists (
    select 1 from name_family.members where room_id = r.id and user_id = u
  ) then
    raise exception 'عضو این اتاق نیستید.';
  end if;
  perform name_family.close_expired_round(r.id);
  select * into r from name_family.rooms where id = r.id;

  case p_action ->> 'type'
    when 'start' then
      if u <> r.host or r.phase <> 'lobby'
         or (select count(*) from name_family.members where room_id = r.id) < 2 then
        raise exception 'میزبان و دست‌کم دو بازیکن لازم است.';
      end if;
      select jsonb_agg((array['آ','ا','ب','پ','ت','ج','چ','ح','خ','د','ر','ز','س','ش','ص','ع','ف','ق','ک','گ','ل','م','ن','و','ه','ی'])[1 + floor(random() * 26)::int])
      into r.letters from generate_series(1, r.rounds_total);
      update name_family.rooms
      set letters = r.letters, phase = 'playing', round_no = 1, stop_deadline = null,
          deadline = case when round_seconds = 0 then null else clock_timestamp() + round_seconds * interval '1 second' end
      where id = r.id;

    when 'reorder' then
      if u <> r.host or r.phase <> 'lobby' then
        raise exception 'فقط میزبان پیش از شروع بازی می‌تواند ترتیب ستون‌ها را تغییر دهد.';
      end if;
      if coalesce(jsonb_typeof(p_action -> 'categories'), '') <> 'array'
         or jsonb_array_length(p_action -> 'categories') <> jsonb_array_length(r.categories)
         or (select count(distinct category) from jsonb_array_elements_text(p_action -> 'categories') as c(category)) <> jsonb_array_length(r.categories)
         or exists (
           select 1 from jsonb_array_elements_text(p_action -> 'categories') as c(category)
           where not (r.categories ? c.category)
         ) then
        raise exception 'ترتیب ستون‌ها معتبر نیست.';
      end if;
      update name_family.rooms set categories = p_action -> 'categories' where id = r.id;

    when 'save' then
      if r.phase <> 'playing' then raise exception 'زمان پاسخ‌گویی تمام شده است.'; end if;
      if p_action ? 'round' and (p_action ->> 'round')::int <> r.round_no then
        raise exception 'این دور دیگر فعال نیست.';
      end if;
      letter := r.letters ->> (r.round_no - 1);
      for cat, v in select key, value from jsonb_each_text(coalesce(p_action -> 'answers', '{}')) loop
        if not (r.categories ? cat) then continue; end if;
        v := left(trim(v), 80);
        if v <> '' and left(lower(regexp_replace(v, '[إأآٱ]', 'ا', 'g')), 1)
           <> left(lower(regexp_replace(letter, '[إأآٱ]', 'ا', 'g')), 1) then
          v := '';
        end if;
        insert into name_family.entries (room_id, round_no, user_id, category, value)
        values (r.id, r.round_no, u, cat, v)
        on conflict (room_id, round_no, user_id, category)
        do update set value = excluded.value;
      end loop;
      if p_action ->> 'stop' = 'true' and r.stop_deadline is null then
        update name_family.rooms
        set stop_deadline = clock_timestamp() + interval '5 seconds'
        where id = r.id;
      end if;

    when 'vote' then
      if r.phase <> 'review' then raise exception 'زمان بررسی نیست.'; end if;
      if p_action ->> 'valid' not in ('true', 'false') then raise exception 'رأی معتبر نیست.'; end if;
      entry_id := (p_action ->> 'entry')::uuid;
      select category into cat
      from name_family.entries
      where id = entry_id and room_id = r.id and round_no = r.round_no
        and user_id <> u and value <> ''
        and category = r.categories ->> r.category_no and not reviewed
      for update;
      if cat is null then raise exception 'این پاسخ قابل رأی نیست.'; end if;
      update name_family.entries
      set votes = votes || jsonb_build_object(u::text, p_action ->> 'valid')
      where id = entry_id;
      select count(*) filter (where value = 'true'), count(*)
      into yes_count, vote_count
      from jsonb_each_text((select votes from name_family.entries where id = entry_id));
      select count(*) - 1 into eligible from name_family.members where room_id = r.id;
      if vote_count >= eligible then
        is_valid := yes_count >= floor(eligible / 2.0) + 1;
        select count(*) filter (where value <> '') into filled
        from name_family.entries where room_id = r.id and round_no = r.round_no and category = cat;
        select count(*) into same_count
        from name_family.entries
        where room_id = r.id and round_no = r.round_no and category = cat
          and lower(trim(value)) = lower(trim((select value from name_family.entries where id = entry_id)))
          and value <> '';
        update name_family.entries
        set reviewed = true, valid = is_valid,
            points = case when is_valid then case when filled = 1 then 20 when same_count > 1 then 5 else 10 end else 0 end
        where id = entry_id;
      end if;

    when 'advance' then
      if r.phase <> 'review' or u <> r.host then
        raise exception 'فقط میزبان در مرحلهٔ بررسی می‌تواند ادامه دهد.';
      end if;
      if r.review_deadline <= clock_timestamp() then
        update name_family.entries
        set reviewed = true, valid = false, points = 0
        where room_id = r.id and round_no = r.round_no
          and category = r.categories ->> r.category_no and value <> '' and not reviewed;
      end if;
      if exists (
        select 1 from name_family.entries
        where room_id = r.id and round_no = r.round_no
          and category = r.categories ->> r.category_no and value <> '' and not reviewed
      ) then
        raise exception 'ابتدا برای پاسخ‌های این ستون رأی بدهید.';
      elsif r.category_no + 1 < jsonb_array_length(r.categories) then
        update name_family.rooms set category_no = category_no + 1 where id = r.id;
      elsif r.round_no >= r.rounds_total then
        update name_family.rooms set phase = 'finished' where id = r.id;
      else
        update name_family.rooms
        set round_no = round_no + 1, category_no = 0, phase = 'playing',
            stop_deadline = null,
            deadline = case when round_seconds = 0 then null else clock_timestamp() + round_seconds * interval '1 second' end,
            review_deadline = null
        where id = r.id;
      end if;

    else
      raise exception 'درخواست نامعتبر است.';
  end case;
  return public.name_family_room(r.code);
end
$$;

create or replace function public.name_family_lobbies() returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', r.code,
    'title', r.title,
    'players', (select count(*) from name_family.members m where m.room_id = r.id),
    'capacity', r.capacity,
    'rounds', r.rounds_total,
    'categories', r.categories
  ) order by r.created_at desc), '[]')
  from name_family.rooms r where r.is_public and r.phase = 'lobby'
$$;

revoke all on all tables in schema name_family from public, anon, authenticated;
revoke all on all functions in schema name_family from public, anon, authenticated;
revoke execute on function public.name_family_create(text, boolean, int, jsonb, int, int),
  public.name_family_join(text), public.name_family_room(text), public.name_family_act(text, jsonb),
  public.name_family_lobbies() from public, anon;
grant execute on function public.name_family_create(text, boolean, int, jsonb, int, int),
  public.name_family_join(text), public.name_family_room(text), public.name_family_act(text, jsonb),
  public.name_family_lobbies() to authenticated;
