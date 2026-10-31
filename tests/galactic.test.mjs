import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  snakeTurn,
  positionFit,
  matchClock,
  bracketOrder,
  playerChemistry,
} from '../lib/galactic/rules.mjs';
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
  for (const f of Object.values(config.formations)) {
    assert.equal(f.slots.length, 11);
    assert.equal(f.slots.filter((s) => s.role === 'GK').length, 1);
    assert.equal(new Set(f.slots.map((s) => s.id)).size, 11);
    assert(!/[۰-۹]/.test(f.name));
  }
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
test('authoritative rooms, permissions, draft, byes and simultaneous tournament', async (t) => {
  const db = await setup();
  try {
    await t.test('anonymous and direct private access denied', async () => {
      await db.exec('set role anon');
      await assert.rejects(rpc(db, 'catalog'));
      await assert.rejects(db.query('select * from galactic_private.rooms'));
      await db.exec('reset role');
      await db.exec('set role authenticated');
      const cat = await rpc(db, 'catalog');
      assert.equal(cat.players.length, players.length);
      assert(cat.players.every((p) => p.overall === undefined && p.shooting === undefined));
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
            "select round,started_at,ends_at from galactic_private.matches where room_id=$1 and status='finished'order by started_at",
            [room.id],
          )
        ).rows;
        const rounds = [...new Set(starts.map((m) => m.round))];
        for (const round of rounds) {
          const same = starts.filter((m) => m.round === round);
          assert.equal(
            new Set(same.map((m) => String(m.started_at))).size,
            1,
            'same round starts together',
          );
          if (round > 1) {
            const prior = starts.filter((m) => m.round < round);
            assert(
              new Date(same[0].started_at) >=
                Math.max(...prior.map((m) => new Date(m.ends_at).getTime())),
              'round waits for all previous matches',
            );
          }
        }
        assert(
          room.members.every((m) =>
            m.players.every((p) => p.overall === undefined && p.effective === undefined),
          ),
        );

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
        assert.equal(early.stats.home.shots, 0);
        assert.equal(early.stats.away.shots, 0);
        assert.equal(early.stats.home.possession + early.stats.away.possession, 100);
        assert.deepEqual(early.sentOffHome, []);
        assert.deepEqual(early.sentOffAway, []);
        for (const side of ['home', 'away']) {
          assert(match.stats[side].onTarget <= match.stats[side].shots);
          assert(match.stats[side].passesCompleted <= match.stats[side].passes);
        }
        const phases = match.timeline.filter((e) => e.sequence === 1);
        assert.equal(phases[0].kind, 'build_up');
        assert(phases.length >= 3);
        assert.equal(phases[0].homeScore, 0);
        assert.equal(phases[0].awayScore, 0);

        const timeline = match.timeline;
        for (let i = 1; i < timeline.length; i++)
          assert(timeline[i].atMs >= timeline[i - 1].untilMs);
        assert(timeline.some((e) => e.kind === 'final'));
        assert(new Date(match.ends_at) - new Date(match.started_at) >= 480000);
      });

    await t.test(
      'aerial, chemistry, position and dismissal factors work independently of overall',
      async () => {
        const a = { id: 'a', name: 'A', club: 'Barcelona', x: 36, y: 75 },
          same = { id: 'b', name: 'B', club: 'Barcelona', x: 64, y: 75 },
          rival = { ...same, club: 'Real Madrid' };
        for (const peer of [same, rival]) {
          const js = playerChemistry(a, [a, peer], config);
          const sql = (
            await db.query('select galactic_private.chemistry($1,$2,$3)as c', [
              a,
              [a, peer],
              config,
            ])
          ).rows[0].c;
          assert.equal(js.level, sql.level);
          assert.equal(js.score, sql.score);
        }
        assert.equal(playerChemistry(a, [a, same], config).level, 'green');
        assert.equal(playerChemistry(a, [a, rival], config).level, 'yellow');
        const pair = [
          { ...a, id: 'kevin-de-bruyne', club: 'Napoli' },
          { ...same, id: 'thibaut-courtois', club: 'Real Madrid' },
        ];
        assert.equal(playerChemistry(pair[0], pair, config).level, 'red');
        const heights = await db.query(
          'select galactic_private.aerial($1)as short,galactic_private.aerial($2)as tall',
          [
            { heading: 80, jumping: 80, heightCm: 170 },
            { heading: 80, jumping: 80, heightCm: 195 },
          ],
        );
        assert(heights.rows[0].tall > heights.rows[0].short);
        const m = (
          await db.query(
            "select m.*from galactic_private.matches m join galactic_private.rooms r on r.id=m.room_id where r.capacity=2 and m.status='finished'limit 1",
          )
        ).rows[0];
        const lineup = (
          await db.query('select galactic_private.lineup($1,$2)as p', [m.room_id, m.home_id])
        ).rows[0].p;
        const full = (
          await db.query("select galactic_private.profile($1,$2,'balanced','[]',10)as p", [
            lineup,
            config,
          ])
        ).rows[0].p;
        const sent = (
          await db.query("select galactic_private.profile($1,$2,'balanced',$3,10)as p", [
            lineup,
            config,
            [lineup.find((p) => p.role === 'CM').id],
          ])
        ).rows[0].p;
        assert(sent.midfield < full.midfield);
        assert.equal(sent.players, full.players - 1);
        const tired = (
          await db.query("select galactic_private.profile($1,$2,'press','[]',110)as p", [
            lineup,
            config,
          ])
        ).rows[0].p;
        const fresh = (
          await db.query("select galactic_private.profile($1,$2,'press','[]',5)as p", [
            lineup,
            config,
          ])
        ).rows[0].p;
        assert(tired.midfield < fresh.midfield);
        await db.query("update galactic_private.matches set status='live'where id=$1", [m.id]);
        const hidden = (
          await db.query('select galactic_private.match_view($1,$2)as p', [m.id, m.started_at])
        ).rows[0].p;
        assert.equal(hidden.endsAt, null);
        assert.equal(hidden.winner, null);
        assert.equal(hidden.stats.home.shots, 0);
        await db.query("update galactic_private.matches set status='finished'where id=$1", [m.id]);
      },
    );

    await t.test('changing only overall does not determine the v2 match outcome', async () => {
      const m = (
        await db.query(
          "select m.*from galactic_private.matches m join galactic_private.rooms r on r.id=m.room_id where r.capacity=2 and m.status='finished'limit 1",
        )
      ).rows[0];
      await db.query('select galactic_private.make_match($1,$2)', [m.id, m.started_at]);
      const before = (
        await db.query('select timeline from galactic_private.matches where id=$1', [m.id])
      ).rows[0].timeline;
      await db.query('update galactic_private.datasets set players=$1 where version=$2', [
        players.map((p) => ({ ...p, overall: 1 })),
        config.version,
      ]);
      await db.query('select galactic_private.make_match($1,$2)', [m.id, m.started_at]);
      assert.deepEqual(
        (await db.query('select timeline from galactic_private.matches where id=$1', [m.id]))
          .rows[0].timeline,
        before,
      );
      await db.query('update galactic_private.datasets set players=$1 where version=$2', [
        players,
        config.version,
      ]);
      await db.query("update galactic_private.matches set status='finished'where id=$1", [m.id]);
    });
    await t.test('legacy rooms keep their frozen sequential simulation', async () => {
      const legacy = { ...config, version: 'galactic-v1', engineVersion: 1 };
      delete legacy.chemistry;
      await db.query('update galactic_private.datasets set active=false');
      await db.query(
        'insert into galactic_private.datasets(version,players,config,active)values($1,$2,$3,true)',
        [legacy.version, players, legacy],
      );
      await user(db, 0);
      let old = await rpc(db, 'create', ['legacy', false, 3]);
      for (let i = 1; i < 3; i++) {
        await user(db, i);
        await rpc(db, 'join', [old.code]);
      }
      for (let i = 0; i < 3; i++) {
        await user(db, i);
        await rpc(db, 'act', [
          old.code,
          {
            type: 'setup',
            formation: '433',
            tactic: 'balanced',
            teamName: 'old ' + i,
            ready: true,
          },
        ]);
      }
      await user(db, 0);
      await rpc(db, 'act', [old.code, { type: 'start' }]);
      await db.query(
        "select galactic_private.advance($1,clock_timestamp()+interval '200 minutes')",
        [old.id],
      );
      const games = (
        await db.query(
          "select started_at,ends_at from galactic_private.matches where room_id=$1 and status='finished'order by started_at",
          [old.id],
        )
      ).rows;
      assert.equal(games.length, 2);
      assert(new Date(games[1].started_at) >= new Date(games[0].ends_at));
      await db.query('update galactic_private.datasets set active=false');
      await db.query('update galactic_private.datasets set active=true where version=$1', [
        config.version,
      ]);
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
          heading: 85,
          jumping: 85,
          crossing: 85,
          longShots: 85,
          freeKicks: 85,
          penalties: 85,
          composure: 85,
          discipline: 70,
          heightCm: 180,
          club: 'Neutral club',
        }));
        await db.query('update galactic_private.datasets set players=$1', [flat]);
        let homeWins = 0,
          extra = 0,
          penalties = 0;
        const kinds = new Set();
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
          for (const e of x.timeline) kinds.add(e.kind);
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
        for (const kind of [
          'build_up',
          'action',
          'yellow_card',
          'red_card',
          'free_kick',
          'penalty_kick',
          'woodwork',
          'offside',
        ])
          assert(kinds.has(kind), 'missing event ' + kind);
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
