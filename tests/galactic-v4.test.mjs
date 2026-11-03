import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, user, rpc, makeRoom, autoDraft, ids } from './galactic-v4-helpers.mjs';
test('v4 saved, balanced and enforced offers with one re-roll per context', async () => {
  const { db, players, config } = await setup();
  try {
    let room = await makeRoom(db, 2, 'cup', 'draft');
    const member = room.members.find((m) => m.self);
    for (const slot of config.formations['433'].slots) {
      room = await rpc(db, 'act', [room.code, { type: 'offers', slot: slot.id }]);
    }
    const saved = room.offers;
    assert.equal(saved.length, 11);
    assert(saved.every((o) => o.players.length === 5));
    const ceilings = saved.map((o) =>
      Math.max(...o.players.map((id) => players.find((p) => p.id === id).overall)),
    );
    assert(
      ceilings.filter((n) => n <= 82).length >= 6,
      'average players remain a real part of the team',
    );
    room = await rpc(db, 'act', [room.code, { type: 'offers', slot: 'gk1' }]);
    assert.deepEqual(room.offers, saved);
    const rerollSlot = saved.find(
      (o) => Math.max(...o.players.map((id) => players.find((p) => p.id === id).overall)) <= 82,
    ).slot;
    const old = saved.find((o) => o.slot === rerollSlot).players;
    room = await rpc(db, 'act', [room.code, { type: 'reroll', slot: rerollSlot }]);
    assert(room.rerolls.draft);
    const fresh = room.offers.find((o) => o.slot === rerollSlot).players;
    assert(!fresh.some((id) => old.includes(id)));
    assert(
      fresh.reduce((n, id) => n + players.find((p) => p.id === id).overall, 0) / fresh.length >
        old.reduce((n, id) => n + players.find((p) => p.id === id).overall, 0) / old.length,
    );
    await assert.rejects(rpc(db, 'act', [room.code, { type: 'reroll', slot: 'cb1' }]));
    await user(
      db,
      room.members.findIndex((m) => m.id === room.turn),
    );
    const turn = room.turn;
    const who = (await db.query('select user_id from galactic_private.members where id=$1', [turn]))
      .rows[0].user_id;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
    await assert.rejects(
      rpc(db, 'act', [
        room.code,
        { type: 'pick', pickNumber: 0, slot: 'gk1', player: 'lionel-messi' },
      ]),
    );
    await autoDraft(db, room, 2);
    assert.equal(
      (await db.query('select count(*) n from galactic_private.picks where room_id=$1', [room.id]))
        .rows[0].n,
      22,
    );
    await db.exec('set role anon');
    await assert.rejects(rpc(db, 'create_room', ['No', false, 2, 'cup', 'draft']));
    await assert.rejects(db.query('select * from galactic_private.offers'));
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
test('v4 round-robin schedules, draws, tie breakers and parallel progression', async (t) => {
  const { db } = await setup();
  try {
    for (const n of [3, 4, 8])
      await t.test(n + ' teams', async () => {
        const room = await makeRoom(db, n, 'league');
        await autoDraft(db, room, n);
        const rows = (
          await db.query(
            'select * from galactic_private.matches where room_id=$1 order by round,slot',
            [room.id],
          )
        ).rows;
        assert.equal(rows.length, (n * (n - 1)) / 2);
        const pairs = new Set(rows.map((m) => [m.home_id, m.away_id].sort().join(':')));
        assert.equal(pairs.size, rows.length);
        for (const round of new Set(rows.map((m) => m.round))) {
          const used = rows.filter((m) => m.round === round).flatMap((m) => [m.home_id, m.away_id]);
          assert.equal(new Set(used).size, used.length);
        }
        await db.query(
          "select galactic_private.advance($1,clock_timestamp()+interval '500 minutes')",
          [room.id],
        );
        const final = (
          await db.query('select * from galactic_private.matches where room_id=$1', [room.id])
        ).rows;
        assert(final.every((m) => m.status === 'finished' && m.stage === 'second'));
        for (const round of new Set(final.map((m) => m.round))) {
          const times = final.filter((m) => m.round === round).map((m) => String(m.started_at));
          assert.equal(new Set(times).size, 1);
        }
        assert(final.every((m) => !m.penalties));
        assert(final.every((m) => !m.timeline.some((e) => e.minute > 90)));
        const standings = (await db.query('select galactic_private.standings($1) r', [room.id]))
          .rows[0].r;
        assert(standings.every((s) => s.played === n - 1));
        assert.equal(
          standings.reduce((a, s) => a + s.gf, 0),
          standings.reduce((a, s) => a + s.ga, 0),
        );
        if (n === 4) {
          const [a, b, c, d] = standings.map((s) => s.id);
          const score = new Map([
            [a + ':' + b, [1, 0]],
            [a + ':' + c, [0, 1]],
            [a + ':' + d, [1, 0]],
            [b + ':' + c, [1, 0]],
            [b + ':' + d, [1, 0]],
            [c + ':' + d, [0, 0]],
          ]);
          for (const m of final) {
            const direct = score.get(m.home_id + ':' + m.away_id),
              reverse = score.get(m.away_id + ':' + m.home_id);
            const pair = direct || [reverse[1], reverse[0]];
            await db.query(
              'update galactic_private.matches set home_score=$2,away_score=$3 where id=$1',
              [m.id, ...pair],
            );
          }
          const table = (await db.query('select galactic_private.standings($1) r', [room.id]))
            .rows[0].r;
          assert.equal(table[0].id, a);
          assert.equal(table[1].id, b);
          for (const k of ['points', 'gd', 'gf']) assert.equal(table[0][k], table[1][k]);
          assert.equal(table[0].head_to_head, 3);
          assert.equal(table[1].head_to_head, 0);
        }
        if (n === 3) {
          const [a, b, c] = standings.map((s) => s.id);
          // Equal points, GD and GF; direct result is the final requested tie breaker.
          for (const m of final) {
            const hs = m.home_id === a ? 2 : m.away_id === a ? 0 : 1;
            const as = m.home_id === a ? 0 : m.away_id === a ? 2 : 1;
            await db.query(
              'update galactic_private.matches set home_score=$2,away_score=$3 where id=$1',
              [m.id, hs, as],
            );
          }
          const table = (await db.query('select galactic_private.standings($1) r', [room.id]))
            .rows[0].r;
          assert.equal(table[0].id, a);
          assert.equal(table[0].points, 6);
          assert.equal(table.find((x) => x.id === b).drawn, 1);
          assert.equal(table.find((x) => x.id === c).drawn, 1);
        }
      });
  } finally {
    await db.close();
  }
});
test('v4 real halftime preserves first half, validates substitutions and changes only this match', async () => {
  const { db, players, config } = await setup();
  try {
    const room = await makeRoom(db, 2);
    await autoDraft(db, room, 2);
    await db.query("select galactic_private.advance($1,clock_timestamp()+interval '23 minutes')", [
      room.id,
    ]);
    let m = (await db.query('select * from galactic_private.matches where room_id=$1', [room.id]))
      .rows[0];
    assert.equal(m.stage, 'first');
    assert(!m.timeline.some((e) => e.minute > 45));
    assert.equal(new Date(m.halftime_until) - new Date(m.halftime_at), 120000);
    assert.equal(m.winner_id, null);
    const self = (await db.query('select * from galactic_private.members where id=$1', [m.home_id]))
      .rows[0];
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [self.user_id]);
    const payload = {
      type: 'halftime',
      match: m.id,
      formation: '433',
      tactic: 'possession',
      players: m.home_setup.players.map((p) => ({ id: p.id, slot: p.slot })),
      roles: {},
    };
    await assert.rejects(rpc(db, 'act', [room.code, payload]));
    // Shift only wall-clock anchors; first-half scenes remain identical.
    await db.query(
      "update galactic_private.matches set started_at=clock_timestamp()-halftime_at+started_at-interval '1 second',halftime_at=clock_timestamp()-interval '1 second',halftime_until=clock_timestamp()+interval '119 seconds',ends_at=clock_timestamp()+interval '119 seconds'where id=$1",
      [m.id],
    );
    m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
    const first = m.timeline;
    const old = m.home_setup.players;
    const taken = (
      await db.query('select player_id from galactic_private.picks where room_id=$1', [room.id])
    ).rows.map((p) => p.player_id);
    const free = players.filter((p) => !taken.includes(p.id));
    let lineup = payload.players.map((p) => ({ ...p }));
    for (let i = 0; i < 6; i++) lineup[i].id = free[i].id;
    await assert.rejects(rpc(db, 'act', [room.code, { ...payload, players: lineup }]));
    lineup = payload.players.map((p) => ({ ...p }));
    for (let i = 0; i < 5; i++) lineup[i].id = free[i].id;
    const roles = { captain: lineup[8].id, penalty: lineup[8].id, freeKick: lineup[7].id };
    const changed = await rpc(db, 'act', [room.code, { ...payload, players: lineup, roles }]);
    assert(changed.halftime);
    assert.equal(changed.halftime.setup.tactic, 'possession');
    assert.equal(changed.halftime.setup.roles.penalty, lineup[8].id);
    assert.deepEqual(
      (await db.query('select timeline from galactic_private.matches where id=$1', [m.id])).rows[0]
        .timeline,
      first,
    );
    const view = (
      await db.query('select galactic_private.match_view($1,clock_timestamp()) r', [m.id])
    ).rows[0].r;
    assert.equal(view.home.tactic, self.tactic, 'edits remain private until restart');
    assert(view.home.players.every((p) => p.overall === undefined));
    assert.equal(
      (await db.query('select count(*) n from galactic_private.reserves where match_id=$1', [m.id]))
        .rows[0].n,
      5,
    );
    await db.query("select galactic_private.advance($1,$2::timestamptz+interval '121 seconds')", [
      room.id,
      new Date().toISOString(),
    ]);
    m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
    assert.equal(m.stage, 'second');
    assert.deepEqual(m.timeline.slice(0, first.length), first);
    assert(m.timeline.some((e) => e.minute > 45));
    assert.equal(
      (await db.query('select tactic from galactic_private.members where id=$1', [m.home_id]))
        .rows[0].tactic,
      self.tactic,
    );
    assert.deepEqual(
      (
        await db.query('select galactic_private.lineup($1,$2) r', [room.id, m.home_id])
      ).rows[0].r.map((p) => p.id),
      old.map((p) => p.id),
    );
    await assert.rejects(rpc(db, 'act', [room.code, { ...payload, players: lineup, roles }]));
  } finally {
    await db.close();
  }
});

test('v4 commentary actors, narrated corners, selected takers and tactical statistics agree', async () => {
  const { db, players } = await setup();
  try {
    const room = await makeRoom(db, 2);
    await autoDraft(db, room, 2);
    let m = (await db.query('select * from galactic_private.matches where room_id=$1', [room.id]))
      .rows[0];
    const home = (await db.query('select galactic_private.lineup($1,$2) r', [room.id, m.home_id]))
      .rows[0].r;
    const away = (await db.query('select galactic_private.lineup($1,$2) r', [room.id, m.away_id]))
      .rows[0].r;
    const hr = { captain: home[5].id, penalty: home[8].id, freeKick: home[6].id };
    const ar = { captain: away[5].id, penalty: away[8].id, freeKick: away[6].id };
    await db.query('update galactic_private.members set roles=$2 where id=$1', [m.home_id, hr]);
    await db.query('update galactic_private.members set roles=$2 where id=$1', [m.away_id, ar]);
    let corners = 0,
      wingerGoals = 0,
      defenderGoals = 0,
      leftWingMentions = 0,
      selectedPenalties = 0,
      selectedFreeKicks = 0;
    const kinds = new Set();
    for (let i = 0; i < 24; i++) {
      await db.query('update galactic_private.rooms set seed=$2 where id=$1', [
        room.id,
        'v4-actors-' + i,
      ]);
      await db.query('select galactic_private.make_match($1,clock_timestamp())', [m.id]);
      await db.query(
        'select galactic_private.simulate_v4($1,started_at,true) from galactic_private.matches where id=$1',
        [m.id],
      );
      m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
      assert(m.home_setup.players.some((p) => p.id === hr.captain && p.captain));
      for (const side of [0, 1]) {
        const team = side === 0 ? home : away,
          stats = m.stats[side === 0 ? 'home' : 'away'];
        const narrated = m.timeline.filter(
          (e) => e.side === side && ['corner_won', 'corner'].includes(e.kind),
        ).length;
        assert.equal(stats.corners, narrated, 'every counted corner has a narrated award');
        corners += narrated;
        assert(stats.onTarget <= stats.shots);
        for (const e of m.timeline.filter((e) => e.side === side)) {
          kinds.add(e.kind);
          if (e.text.includes(team.find((p) => p.role === 'LW').name)) leftWingMentions++;
          if (
            e.kind === 'goal' &&
            team.some((p) => ['LW', 'RW'].includes(p.role) && e.text.includes(p.name))
          )
            wingerGoals++;
          if (e.kind === 'goal' && team.some((p) => p.role === 'CB' && e.text.includes(p.name)))
            defenderGoals++;
          if (e.kind === 'penalty_kick') {
            const designated = team.find((p) => p.id === (side === 0 ? hr : ar).penalty),
              sent = side === 0 ? e.sentOffHome : e.sentOffAway;
            if (!sent.includes(designated.id)) {
              assert(e.text.includes(designated.name));
              selectedPenalties++;
            }
          }
          if (e.kind === 'free_kick') {
            const designated = team.find((p) => p.id === (side === 0 ? hr : ar).freeKick),
              sent = side === 0 ? e.sentOffHome : e.sentOffAway;
            if (!sent.includes(designated.id)) {
              assert(e.text.includes(designated.name));
              selectedFreeKicks++;
            }
          }
        }
      }
    }
    assert(corners > 35);
    assert(wingerGoals > 0);
    assert(defenderGoals > 0);
    assert(leftWingMentions > 20);
    assert(selectedPenalties > 0);
    assert(selectedFreeKicks > 0);
    assert(kinds.has('corner_delivery'));
    // Equal individuals isolate the requested tactical effect on recorded possession.
    const flat = players.map((p) => ({
      ...p,
      positions: ['GK', 'LB', 'RB', 'CB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'],
      pace: 80,
      shooting: 80,
      passing: 80,
      dribbling: 80,
      defending: 80,
      physical: 80,
      stamina: 80,
      goalkeeping: 80,
      club: 'Neutral',
    }));
    await db.query('update galactic_private.datasets set players=$1', [flat]);
    await db.query(
      "update galactic_private.members set tactic=case when id=$2 then 'possession'else 'low_block'end where room_id=$1",
      [room.id, m.home_id],
    );
    await db.query('select galactic_private.make_match($1,clock_timestamp())', [m.id]);
    m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
    assert(m.stats.home.possession > 60);
  } finally {
    await db.close();
  }
});

test('draft halftime has its own single re-roll and rejects replacements outside saved choices', async () => {
  const { db, players } = await setup();
  try {
    let room = await makeRoom(db, 2, 'league', 'draft');
    await user(db, 0);
    const initialOffers = [];
    for (const slot of [
      'gk1',
      'lb1',
      'cb1',
      'cb2',
      'rb1',
      'dm1',
      'cm1',
      'cm2',
      'lw1',
      'st1',
      'rw1',
    ]) {
      const v = await rpc(db, 'act', [room.code, { type: 'offers', slot }]);
      initialOffers.push(v.offers.find((o) => o.slot === slot));
    }
    const lowSlot = initialOffers.find(
      (o) => Math.max(...o.players.map((id) => players.find((p) => p.id === id).overall)) <= 82,
    ).slot;
    await rpc(db, 'act', [room.code, { type: 'reroll', slot: lowSlot }]);
    await autoDraft(db, room, 2);
    await db.query("select galactic_private.advance($1,clock_timestamp()+interval '24 minutes')", [
      room.id,
    ]);
    let m = (await db.query('select * from galactic_private.matches where room_id=$1', [room.id]))
      .rows[0];
    await db.query(
      "update galactic_private.matches set started_at=clock_timestamp()-halftime_at+started_at-interval '1 second',halftime_at=clock_timestamp()-interval '1 second',halftime_until=clock_timestamp()+interval '119 seconds',ends_at=clock_timestamp()+interval '119 seconds'where id=$1",
      [m.id],
    );
    room = await rpc(db, 'room', [room.code]);
    let halfSlot;
    for (const current of room.halftime.setup.players) {
      if (room.halftime.sentOff.includes(current.id)) continue;
      room = await rpc(db, 'act', [
        room.code,
        { type: 'offers', match: m.id, slot: current.slot, formation: '433' },
      ]);
      const choices = room.offers.find(
        (o) => o.context === m.id && o.slot === current.slot,
      ).players;
      const best = Math.max(...choices.map((id) => players.find((p) => p.id === id).overall));
      if (
        players.some(
          (p) =>
            p.positions.includes(current.role) &&
            p.overall > best &&
            !room.picks.some((pk) => pk.player === p.id),
        )
      ) {
        halfSlot = current.slot;
        break;
      }
    }
    assert(halfSlot);
    assert(room.rerolls.draft);
    room = await rpc(db, 'act', [
      room.code,
      { type: 'reroll', match: m.id, slot: halfSlot, formation: '433' },
    ]);
    assert(room.rerolls[m.id]);
    await assert.rejects(rpc(db, 'act', [room.code, { type: 'reroll', match: m.id, slot: 'cb1' }]));
    const own = room.halftime.setup;
    const options = room.offers.find((o) => o.context === m.id && o.slot === halfSlot).players;
    const taken = room.picks.map((p) => p.player);
    const rogue = players.find((p) => !taken.includes(p.id) && !options.includes(p.id));
    const original = own.players.map((p) => ({ id: p.id, slot: p.slot }));
    const make = (id) => original.map((p) => (p.slot === halfSlot ? { ...p, id } : p));
    const payload = {
      type: 'halftime',
      match: m.id,
      formation: '433',
      tactic: 'central',
      roles: {},
      players: make(rogue.id),
    };
    await assert.rejects(rpc(db, 'act', [room.code, payload]));
    const saved = await rpc(db, 'act', [room.code, { ...payload, players: make(options[0]) }]);
    assert(saved.halftime.setup.players.some((p) => p.id === options[0]));
    const opponent = saved.members.find((m) => !m.self);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      (await db.query('select user_id from galactic_private.members where id=$1', [opponent.id]))
        .rows[0].user_id,
    ]);
    const other = await rpc(db, 'room', [room.code]);
    assert(!other.offers.some((o) => o.players.includes(options[0])));
    assert(other.unavailable.includes(options[0]));
    await db.query("select galactic_private.advance($1,clock_timestamp()+interval '200 minutes')", [
      room.id,
    ]);
    assert.equal(
      (await db.query('select phase from galactic_private.rooms where id=$1', [room.id])).rows[0]
        .phase,
      'finished',
    );
  } finally {
    await db.close();
  }
});
