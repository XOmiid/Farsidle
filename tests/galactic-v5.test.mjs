import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeRoom, autoDraft, rpc } from './galactic-v4-helpers.mjs';
import { footballMinuteLabel } from '../lib/galactic/rules.mjs';
test('stoppage-time clocks distinguish both halves', () => {
  assert.equal(footballMinuteLabel(47.5, 45), '45+02:30');
  assert.equal(footballMinuteLabel(94, 90), '90+04:00');
  assert.equal(footballMinuteLabel(45), '45:00');
});
test('v5 fewer chances, readable stages, stoppage opportunities and roughly 40 percent conversion', async () => {
  const { db, players } = await setup({ engineVersion: 5 });
  try {
    const r = await makeRoom(db, 2, 'league');
    await autoDraft(db, r, 2);
    const mid = (await db.query('select id from galactic_private.matches where room_id=$1', [r.id]))
      .rows[0].id;
    const flat = players.map((p) => ({
      ...p,
      pace: 80,
      shooting: 80,
      passing: 80,
      dribbling: 80,
      defending: 80,
      physical: 80,
      stamina: 80,
      goalkeeping: 80,
      heading: 80,
      jumping: 80,
      crossing: 80,
      longShots: 80,
      freeKicks: 80,
      penalties: 80,
      composure: 80,
      club: 'Neutral',
      heightCm: 180,
    }));
    await db.query('update galactic_private.datasets set players=$1', [flat]);
    await db.query("update galactic_private.members set tactic='balanced'where room_id=$1", [r.id]);
    let goals = 0,
      chances = 0,
      zero = 0,
      rushGoals = 0,
      rushMisses = 0,
      duration = 0;
    for (let i = 0; i < 100; i++) {
      await db.query('update galactic_private.rooms set seed=$2 where id=$1', [
        r.id,
        'highlight-calibration-' + i,
      ]);
      await db.query('select galactic_private.make_match($1,now())', [mid]);
      let m = (await db.query('select * from galactic_private.matches where id=$1', [mid])).rows[0];
      assert.equal(m.timeline.filter((e) => e.kind === 'build_up').length, 5);
      assert.equal(m.winner_id, null);
      assert(m.timeline.some((e) => e.kind === 'stoppage_time' && e.addedMinutes >= 2));
      assert(m.timeline.some((e) => e.dangerous && e.stoppageBase === 45 && e.minute > 45));
      const first = m.timeline.slice();
      await db.query(
        'select galactic_private.simulate_v4($1,started_at,true)from galactic_private.matches where id=$1',
        [mid],
      );
      m = (await db.query('select * from galactic_private.matches where id=$1', [mid])).rows[0];
      assert.deepEqual(m.timeline.slice(0, first.length), first);
      const builds = m.timeline.filter((e) => e.kind === 'build_up');
      assert.equal(builds.length, 10);
      chances += builds.length;
      const n = m.home_score + m.away_score;
      goals += n;
      if (!n) zero++;
      assert(
        m.timeline.some(
          (e) => e.kind === 'stoppage_time' && e.addedMinutes >= 3 && e.stoppageBase === 90,
        ),
      );
      assert(m.timeline.some((e) => e.dangerous && e.stoppageBase === 90 && e.minute > 90));
      assert(!m.timeline.some((e) => e.kind === 'extra_start'));
      for (let j = 0; j < m.timeline.length; j++) {
        const e = m.timeline[j];
        assert(e.untilMs - e.atMs >= 8000, 'read time');
        if (j) assert(e.atMs >= m.timeline[j - 1].untilMs, 'no overlapping phases');
        if (e.dangerous && e.kind === 'build_up') {
          assert(!/گل!|مهار می‌کند|بیرون می‌رود/.test(e.text));
        }
        if (e.kind === 'keeper_rush') {
          const closing = m.timeline.filter((x) => x.sequence === e.sequence).at(-1);
          if (closing.kind === 'goal') rushGoals++;
          else rushMisses++;
          assert.equal(e.homeScore, m.timeline[j - 1].homeScore);
          assert.equal(e.awayScore, m.timeline[j - 1].awayScore);
        }
      }
      assert.equal(m.stats.home.shots + m.stats.away.shots, 10);
      duration += new Date(m.ends_at) - new Date(m.started_at);
    }
    const conversion = goals / chances;
    assert(conversion > 0.34 && conversion < 0.48, 'conversion ' + conversion);
    assert(zero < 8, '0-0 remains rare, not artificially forbidden');
    assert(rushGoals > 0 && rushMisses > 0);
    assert(duration / 100 < 600000, 'faster than the prior ten-minute match including halftime');
    console.log(
      'V5 calibration',
      JSON.stringify({
        games: 100,
        goals,
        conversion,
        zero,
        rushGoals,
        rushMisses,
        meanSeconds: Math.round(duration / 100000),
      }),
    );
  } finally {
    await db.close();
  }
});
test('v5 halftime saves lock, close independently and resume immediately when both are saved', async () => {
  const { db } = await setup({ engineVersion: 5 });
  try {
    const r = await makeRoom(db, 2, 'league', 'draft');
    await autoDraft(db, r, 2);
    await db.query("select galactic_private.advance($1,clock_timestamp()+interval '24 minutes')", [
      r.id,
    ]);
    let m = (await db.query('select * from galactic_private.matches where room_id=$1', [r.id]))
      .rows[0];
    await db.query(
      "update galactic_private.matches set started_at=clock_timestamp()-halftime_at+started_at-interval '1 second',halftime_at=clock_timestamp()-interval '1 second',halftime_until=clock_timestamp()+interval '119 seconds',ends_at=clock_timestamp()+interval '119 seconds'where id=$1",
      [m.id],
    );
    m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
    const originalDeadline = new Date(m.halftime_until);
    const original = m.timeline;
    for (const [i, id] of [m.home_id, m.away_id].entries()) {
      const u = (await db.query('select user_id from galactic_private.members where id=$1', [id]))
        .rows[0].user_id;
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u]);
      const v = await rpc(db, 'room', [r.code]);
      assert.equal(v.halftime.saved, false);
      const s = v.halftime.setup;
      const action = {
        type: 'halftime',
        match: m.id,
        formation: s.formation,
        tactic: s.tactic,
        roles: {},
        players: s.players.map((p) => ({ id: p.id, slot: p.slot })),
      };
      const result = await rpc(db, 'act', [r.code, action]);
      if (i === 0) {
        assert(result.halftime.saved);
        assert.equal(
          (await db.query('select stage from galactic_private.matches where id=$1', [m.id])).rows[0]
            .stage,
          'first',
        );
        await assert.rejects(rpc(db, 'act', [r.code, action]));
        await assert.rejects(
          rpc(db, 'act', [r.code, { type: 'offers', match: m.id, slot: 'rb1' }]),
        );
        await assert.rejects(
          rpc(db, 'act', [r.code, { type: 'reroll', match: m.id, slot: 'rb1' }]),
        );
      } else {
        assert.equal(result.halftime, null);
        assert.equal(result.currentMatch.halftime, false);
      }
    }
    m = (await db.query('select * from galactic_private.matches where id=$1', [m.id])).rows[0];
    assert(m.home_saved && m.away_saved);
    assert.equal(m.stage, 'second');
    assert(new Date(m.halftime_until) < originalDeadline);
    assert.deepEqual(m.timeline.slice(0, original.length - 1), original.slice(0, -1));
    const pause = m.timeline[original.length - 1];
    assert(pause.untilMs < original.at(-1).untilMs);
    assert(m.timeline[original.length].atMs >= pause.untilMs);
    assert(m.timeline.some((e) => e.kind === 'second_half'));
  } finally {
    await db.close();
  }
});
test('v5 halftime still resumes on timeout if a team does not save', async () => {
  const { db } = await setup({ engineVersion: 5 });
  try {
    const r = await makeRoom(db, 2, 'cup');
    await autoDraft(db, r, 2);
    await db.query("select galactic_private.advance($1,clock_timestamp()+interval '200 minutes')", [
      r.id,
    ]);
    const m = (await db.query('select * from galactic_private.matches where room_id=$1', [r.id]))
      .rows[0];
    assert.equal(m.stage, 'second');
    assert.equal(m.status, 'finished');
    assert(m.winner_id);
    assert(!m.home_saved && !m.away_saved);
    assert(
      m.timeline.filter((e) => e.kind === 'halftime').every((e) => e.untilMs - e.atMs === 120000),
    );
  } finally {
    await db.close();
  }
});
