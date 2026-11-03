import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ids = Array.from(
  { length: 8 },
  (_, i) => '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
);
export async function setup({ engineVersion = 4 } = {}) {
  const db = await PGlite.create();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid()to anon,authenticated;create table public.profiles(id uuid primary key,username text);",
  );
  for (let i = 0; i < 8; i++) {
    await db.query('insert into auth.users values($1)', [ids[i]]);
    await db.query('insert into profiles values($1,$2)', [ids[i], 'manager_' + i]);
  }
  for (const file of ['schema', 'engine', 'rooms', 'v4', 'v5', 'v6'])
    await db.exec(
      await readFile(new URL('../supabase/galactic-' + file + '.sql', import.meta.url), 'utf8'),
    );
  const players = JSON.parse(
      await readFile(new URL('../data/galactic/players.json', import.meta.url), 'utf8'),
    ),
    config = JSON.parse(
      await readFile(new URL('../data/galactic/config.json', import.meta.url), 'utf8'),
    );
  config.engineVersion = engineVersion;
  config.version = 'galactic-v' + engineVersion;
  await db.query(
    'insert into galactic_private.datasets(version,players,config,active)values($1,$2,$3,true)',
    [config.version, players, config],
  );
  return { db, players, config };
}
export async function user(db, i) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[i]]);
}
export async function rpc(db, name, args = []) {
  return (
    await db.query(
      'select public.galactic_' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') r',
      args,
    )
  ).rows[0].r;
}
export async function makeRoom(db, n, competition = 'cup', selection = 'normal') {
  await user(db, 0);
  let room = await rpc(db, 'create_room', [
    'Test ' + competition,
    false,
    n,
    competition,
    selection,
  ]);
  for (let i = 1; i < n; i++) {
    await user(db, i);
    await rpc(db, 'join', [room.code]);
  }
  for (let i = 0; i < n; i++) {
    await user(db, i);
    await rpc(db, 'act', [
      room.code,
      {
        type: 'setup',
        formation: '433',
        tactic: i % 2 ? 'balanced' : 'wide',
        teamName: 'Team ' + i,
        ready: true,
      },
    ]);
  }
  await user(db, 0);
  room = await rpc(db, 'act', [room.code, { type: 'start' }]);
  return room;
}
export async function autoDraft(db, room, n) {
  for (let i = 0; i < n * 11; i++)
    await db.query(
      "select galactic_private.advance($1,clock_timestamp()+($2||' seconds')::interval)",
      [room.id, (i + 1) * 60 + 1],
    );
}
