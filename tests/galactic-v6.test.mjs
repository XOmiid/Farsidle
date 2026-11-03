import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeRoom, autoDraft, rpc, user } from './galactic-v4-helpers.mjs';
import { matchRatings, teamIncidents } from '../lib/galactic/performance.mjs';
test('performance starts at 6.5; actions, not ability, determine ratings and incident teams', () => {
  const p = { id: 'a', name: 'A', side: 0, role: 'ST' },
    q = { id: 'b', name: 'B', side: 0 },
    k = { id: 'k', name: 'K', side: 1 };
  assert.equal(matchRatings([p], [], 0)[0].rating, '6.5');
  const events = [
    { kind: 'action', actor: q, goodPass: true },
    { kind: 'goal', actor: p, provider: q, keeper: k },
    { kind: 'red_card', side: 0, actor: k },
  ];
  const ratings = matchRatings([p, q], events, 0);
  assert.equal(ratings[0].rating, '7.4');
  assert.equal(ratings[1].assists, 1);
  assert.equal(teamIncidents(events, 1)[0].kind, 'red_card');
  assert.equal(teamIncidents(events, 0).length, 1);
  assert.equal(matchRatings([p], Array(30).fill(events[1]), 0)[0].rating, '10.0');
  assert.equal(matchRatings([k], Array(30).fill(events[2]), 1)[0].rating, '1.0');
});
test('standalone captain and set-piece roles save atomically; v6 events have revealed actors', async () => {
  const { db } = await setup({ engineVersion: 6 });
  try {
    const r = await makeRoom(db, 2, 'league');
    await autoDraft(db, r, 2);
    await user(db, 0);
    const view = await rpc(db, 'room', [r.code]);
    const me = view.members.find((m) => m.id === view.self);
    const roles = {
      captain: me.players[0].id,
      penalty: me.players[1].id,
      freeKick: me.players[2].id,
    };
    await rpc(db, 'act', [r.code, { type: 'roles', roles }]);
    assert.deepEqual(
      (await db.query('select roles from galactic_private.members where id=$1', [me.id])).rows[0]
        .roles,
      roles,
    );
    await assert.rejects(
      rpc(db, 'act', [r.code, { type: 'roles', roles: { captain: 'not-a-player' } }]),
    );
    assert.deepEqual(
      (await db.query('select roles from galactic_private.members where id=$1', [me.id])).rows[0]
        .roles,
      roles,
    );
    const mid = (await db.query('select id from galactic_private.matches where room_id=$1', [r.id]))
      .rows[0].id;
    await db.query('select galactic_private.make_match($1,now())', [mid]);
    await db.query(
      'select galactic_private.simulate_v4($1,started_at,true)from galactic_private.matches where id=$1',
      [mid],
    );
    const m = (await db.query('select * from galactic_private.matches where id=$1', [mid])).rows[0];
    assert.equal(m.stats.engine, 6);
    for (const e of m.timeline.filter((e) => e.dangerous)) {
      assert(e.actor?.id, e.kind + ' actor');
      assert(e.untilMs - e.atMs >= 10000);
      if (['red_card', 'yellow_card', 'corner_won'].includes(e.kind))
        assert.equal(e.actor.side, 1 - e.side);
      if (e.kind === 'goal') {
        assert.equal(e.actor.side, e.side);
        assert.equal(e.keeper.side, 1 - e.side);
      }
    }
    const early = (
      await db.query(
        'select galactic_private.match_view($1,started_at) v from galactic_private.matches where id=$1',
        [mid],
      )
    ).rows[0].v;
    assert(!early.events.some((e) => e.kind === 'goal'));
    assert(matchRatings(early.home.players, early.events, 0).every((p) => p.rating === '6.5'));
    assert.equal(early.home.ratingPlayers.length, 11);
    assert(!early.home.ratingPlayers.some((p) => 'overall' in p || 'shooting' in p));
    await db.query(
      'update galactic_private.datasets set config=config||\'{"engineVersion":5}\'::jsonb',
    );
    await db.query('select galactic_private.make_match($1,now())', [mid]);
    await db.query(
      'select galactic_private.simulate_v4($1,started_at,true)from galactic_private.matches where id=$1',
      [mid],
    );
    const old = (await db.query('select * from galactic_private.matches where id=$1', [mid]))
      .rows[0];
    assert.equal(old.home_score, m.home_score);
    assert.equal(old.away_score, m.away_score);
    assert.deepEqual(
      old.timeline.filter((e) => e.kind === 'goal').map((e) => [e.minute, e.side]),
      m.timeline.filter((e) => e.kind === 'goal').map((e) => [e.minute, e.side]),
    );
  } finally {
    await db.close();
  }
});
