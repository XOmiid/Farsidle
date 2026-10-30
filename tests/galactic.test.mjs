import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { snakeTurn, positionFit, matchClock, bracketOrder } from '../lib/galactic/rules.mjs';
const load = async (p) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const players = await load('data/galactic/players.json'),
  config = await load('data/galactic/config.json');
const ids = Array.from(
  { length: 9 },
  (_, i) => '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
);
async function rpc(db, name, args = []) {
  return (
    await db.query(
      'select public.galactic_' +
        name +
        '(' +
        args.map((_, i) => '$' + (i + 1)).join(',') +
        ') as r',
      args,
    )
  ).rows[0].r;
}
async function user(db, i) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[i]]);
}
async function setup() {
  const db = await PGlite.create();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid()to anon,authenticated;create table public.profiles(id uuid primary key,username text);`,
  );
  for (let i = 0; i < ids.length; i++) {
    await db.query('insert into auth.users values($1)', [ids[i]]);
    await db.query('insert into profiles values($1,$2)', [ids[i], 'manager_' + i]);
  }
  for (const file of ['schema', 'engine', 'rooms'])
    await db.exec(
      await readFile(new URL('../supabase/galactic-' + file + '.sql', import.meta.url), 'utf8'),
    );
  await db.query(
    'insert into galactic_private.datasets(version,players,config,active)values($1,$2,$3,true)',
    [config.version, players, config],
  );
  await user(db, 0);
  return db;
}
test('snake, bracket, fit and paused clock', () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, i) => snakeTurn(['a', 'b', 'c'], i)),
    ['a', 'b', 'c', 'c', 'b', 'a', 'a', 'b', 'c'],
  );
  assert.equal(positionFit(['ST'], 'GK', config.adjacency), 0.15);
  assert.equal(positionFit(['ST'], 'ST', config.adjacency), 1);
  assert.deepEqual(bracketOrder(8), [0, 7, 3, 4, 1, 6, 2, 5]);
  assert.equal(
    matchClock(
      { minute: 20, pausedUntil: 1000, anchorAt: 1000, nextMinute: 30, minuteMs: 2000 },
      500,
    ),
    20,
  );
});
test('real-player custom-rated pool supports eight unique XIs', () => {
  assert(players.length >= 88);
  assert.equal(new Set(players.map((p) => p.id)).size, players.length);
  assert.equal(new Set(players.map((p) => p.league)).size, 5);
  assert(players.filter((p) => p.positions.includes('GK')).length >= 8);
  for (const p of players) {
    for (const k of [
      'overall',
      'pace',
      'shooting',
      'passing',
      'dribbling',
      'defending',
      'physical',
      'stamina',
      'goalkeeping',
    ])
      assert(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 99, p.id + ':' + k);
  }
});
test('authoritative rooms, permissions, draft, byes and sequential tournament', async (t) => {
  const db = await setup();
  try {
    await t.test('anonymous and direct private access denied', async () => {
      await db.exec('set role anon');
      await assert.rejects(rpc(db, 'catalog'));
      await assert.rejects(db.query('select * from galactic_private.rooms'));
      await db.exec('reset role');
      await db.exec('set role authenticated');
      assert.equal((await rpc(db, 'catalog')).players.length, players.length);
      await assert.rejects(db.query("select galactic_private.random_value('x',1)"));
      await db.exec('reset role');
    });
    for (const n of [2, 3, 5, 8])
      await t.test(n + ' human teams complete safely', async () => {
        await user(db, 0);
        let room = await rpc(db, 'create', ['test ' + n, false, n]);
        const code = room.code;
        await user(db, 8);
        await assert.rejects(rpc(db, 'room', [code]));
        assert.equal((await rpc(db, 'lobbies')).rooms.length, 0);
        for (let i = 1; i < n; i++) {
          await user(db, i);
          room = await rpc(db, 'join', [code]);
        }
        await user(db, 8);
        await assert.rejects(rpc(db, 'join', [code]));
        for (let i = 0; i < n; i++) {
          await user(db, i);
          room = await rpc(db, 'act', [
            code,
            {
              type: 'setup',
              formation: '433',
              tactic: i % 2 ? 'counter' : 'balanced',
              teamName: 'تیم ' + i,
              ready: true,
            },
          ]);
        }
        await user(db, 0);
        room = await rpc(db, 'act', [code, { type: 'start' }]);
        assert.equal(room.phase, 'draft');
        assert.equal(room.turn, room.draftOrder[0]);
        await assert.rejects(
          rpc(db, 'act', [
            code,
            { type: 'setup', formation: '442', tactic: 'balanced', teamName: 'test', ready: true },
          ]),
        );
        const first = room.members.find((m) => m.id === room.turn);
        await user(db, Number(first.name.split('_')[1]));
        const gk = players.find((p) => p.positions.includes('GK'));
        room = await rpc(db, 'act', [
          code,
          { type: 'pick', pickNumber: 0, player: gk.id, slot: 'gk1' },
        ]);
        assert.equal(room.picks.length, 1);
        assert.equal(room.picks[0].automatic, false);
        const stale = await rpc(db, 'act', [
          code,
          { type: 'pick', pickNumber: 0, player: gk.id, slot: 'gk1' },
        ]);
        assert(stale.notice);
        await db.query(
          "select galactic_private.advance($1,clock_timestamp()+interval '200 minutes')",
          [room.id],
        );
        room = (
          await db.query(
            "select galactic_private.room_view($1,$2,clock_timestamp()+interval '200 minutes')as r",
            [room.id, ids[0]],
          )
        ).rows[0].r;
        assert.equal(room.picks.length, n * 11);
        assert.equal(new Set(room.picks.map((p) => p.player)).size, n * 11);
        assert(room.members.every((m) => m.players.length === 11));
        assert.equal(room.phase, 'finished');
        assert(room.winner);
        assert.equal(room.matches.filter((m) => m.status === 'finished').length, n - 1);
        const starts = (
          await db.query(
            "select started_at,ends_at from galactic_private.matches where room_id=$1 and status='finished'order by started_at",
            [room.id],
          )
        ).rows;
        for (let i = 1; i < starts.length; i++)
          assert(new Date(starts[i].started_at) >= new Date(starts[i - 1].ends_at));
        const match = (
          await db.query(
            'select * from galactic_private.matches where room_id=$1 and started_at is not null order by started_at limit 1',
            [room.id],
          )
        ).rows[0];
        const early = (
          await db.query('select galactic_private.match_view($1,$2)as r', [
            match.id,
            match.started_at,
          ])
        ).rows[0].r;
        assert.equal(early.events.length, 1);
        assert.equal(early.homeScore, 0);
        assert.equal(early.awayScore, 0);
        const timeline = match.timeline;
        for (let i = 1; i < timeline.length; i++)
          assert(timeline[i].atMs >= timeline[i - 1].untilMs);
        assert(timeline.some((e) => e.kind === 'final'));
        assert(new Date(match.ends_at) - new Date(match.started_at) >= 300000);
      });

    await t.test(
      'simulation is repeatable, symmetric, quality-sensitive and resolves extra time',
      async () => {
        const m = (
          await db.query(
            "select m.* from galactic_private.matches m join galactic_private.rooms r on r.id=m.room_id where r.capacity=2 and m.status='finished'limit 1",
          )
        ).rows[0];
        await db.query("update galactic_private.members set tactic='balanced'where room_id=$1", [
          m.room_id,
        ]);
        const flat = players.map((p) => ({
          ...p,
          positions: Object.keys(config.roles),
          overall: 85,
          pace: 85,
          shooting: 85,
          passing: 85,
          dribbling: 85,
          defending: 85,
          physical: 85,
          stamina: 85,
          goalkeeping: 85,
        }));
        await db.query('update galactic_private.datasets set players=$1', [flat]);
        let homeWins = 0,
          extra = 0,
          penalties = 0;
        for (let i = 0; i < 40; i++) {
          await db.query('update galactic_private.rooms set seed=$2 where id=$1', [
            m.room_id,
            'neutral-' + i,
          ]);
          await db.query('select galactic_private.make_match($1,now())', [m.id]);
          const x = (
            await db.query(
              'select timeline,winner_id,penalties from galactic_private.matches where id=$1',
              [m.id],
            )
          ).rows[0];
          if (x.winner_id === m.home_id) homeWins++;
          if (x.timeline.some((e) => e.kind === 'extra_start')) extra++;
          if (x.penalties) penalties++;
          if (i === 0) {
            await db.query('select galactic_private.make_match($1,now())', [m.id]);
            assert.deepEqual(
              (await db.query('select timeline from galactic_private.matches where id=$1', [m.id]))
                .rows[0].timeline,
              x.timeline,
            );
          }
          assert(x.winner_id);
        }
        assert(homeWins >= 10 && homeWins <= 30, 'neutral home wins ' + homeWins);
        assert(extra > 0);
        assert(penalties > 0);
        const homeIds = new Set(
          (
            await db.query(
              'select player_id from galactic_private.picks where room_id=$1 and member_id=$2',
              [m.room_id, m.home_id],
            )
          ).rows.map((p) => p.player_id),
        );
        const unequal = flat.map((p) => {
          const n = homeIds.has(p.id) ? 98 : 40;
          return {
            ...p,
            overall: n,
            pace: n,
            shooting: n,
            passing: n,
            dribbling: n,
            defending: n,
            physical: n,
            stamina: n,
            goalkeeping: n,
          };
        });
        await db.query('update galactic_private.datasets set players=$1', [unequal]);
        homeWins = 0;
        for (let i = 0; i < 40; i++) {
          await db.query('update galactic_private.rooms set seed=$2 where id=$1', [
            m.room_id,
            'quality-' + i,
          ]);
          await db.query('select galactic_private.make_match($1,now())', [m.id]);
          if (
            (await db.query('select winner_id from galactic_private.matches where id=$1', [m.id]))
              .rows[0].winner_id === m.home_id
          )
            homeWins++;
        }
        assert(homeWins >= 30, 'stronger team wins ' + homeWins);
      },
    );
  } finally {
    await db.close();
  }
});
