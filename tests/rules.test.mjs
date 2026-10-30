import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  iranTime,
  createGame,
  applyAction,
  gameView,
  dateKey,
  rolloverAt,
  feedback,
  remaining,
  normalize,
  crosswordSolution,
} from '../lib/classic/rules.mjs';
const catalog = JSON.parse(
  await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'),
);
const now = Date.parse('2026-10-30T10:00:00Z'),
  day = dateKey(now);
test('Tehran day switches exactly at 21:00 and returns a future rollover', () => {
  assert.equal(dateKey(Date.parse('2026-10-30T17:29:59Z')), '2026-10-30');
  assert.equal(dateKey(Date.parse('2026-10-30T17:30:00Z')), '2026-10-31');
  assert.equal(rolloverAt(Date.parse('2026-10-30T17:29:59Z')), Date.parse('2026-10-30T17:30:00Z'));
  assert.equal(rolloverAt(Date.parse('2026-10-30T17:30:00Z')), Date.parse('2026-10-31T17:30:00Z'));
});
test('Wordle repeated letters cannot claim extra matches', () => {
  assert.deepEqual(feedback('اااا', 'اباب'), ['correct', 'absent', 'correct', 'absent']);
  assert.equal(normalize('آبي كوه'), 'ابیكوه'.replace('ك', 'ک'));
});
test('Wordle accepts guesses outside the answer list and finishing is immutable', () => {
  let s = createGame('wordle', day, catalog, now);
  const unlisted = 'ظ'.repeat(s.puzzle.length);
  assert(!catalog.words.map(normalize).includes(unlisted));
  s = applyAction(s, { type: 'guess', word: unlisted }, catalog, now);
  assert.equal(s.history[0].word, unlisted);
  assert.equal(s.won, false);
  assert.throws(() => applyAction(s, { type: 'guess', word: 'ا' }, catalog, now));
  assert.throws(() =>
    applyAction(s, { type: 'guess', word: 'x'.repeat(s.puzzle.length) }, catalog, now),
  );
  assert.throws(() =>
    applyAction(s, { type: 'guess', word: '۱'.repeat(s.puzzle.length) }, catalog, now),
  );
  assert.equal(gameView(s).secret, undefined);
  assert.equal(gameView(s).answer, undefined);
  s = applyAction(s, { type: 'guess', word: s.secret.word }, catalog, now);
  assert.equal(s.won, true);
  assert.equal(s.reward, 50);
  assert.deepEqual(applyAction(s, { type: 'guess', word: 'whatever' }, catalog, now), s);
});
test('Factle has five different countries and exactly one answer per round', () => {
  let s = createGame('factle', day, catalog, now);
  assert.equal(new Set(s.secret.countries.map((c) => c.id)).size, 5);
  assert.equal(gameView(s).puzzle.rounds.length, 5);
  for (const c of s.secret.countries)
    s = applyAction(s, { type: 'guess', country: c.id }, catalog, now);
  assert.equal(s.score, 5);
  assert.equal(s.finished, true);
  assert.equal(s.reward, 100);
  assert.equal(s.history.length, 5);
});
test('Color preview cannot be restarted and early guesses are rejected', () => {
  let s = createGame('colordle', day, catalog, now);
  assert.equal(gameView(s).puzzle.target, undefined);
  s = applyAction(s, { type: 'reveal' }, catalog, now);
  assert.equal(applyAction(s, { type: 'reveal' }, catalog, now + 9000).puzzle.revealedAt, now);
  assert.throws(() => applyAction(s, { type: 'color', rgb: [0, 0, 0] }, catalog, now + 9999));
  s = applyAction(s, { type: 'color', rgb: [0, 0, 0] }, catalog, now + 10000);
  assert(s.score >= 0 && s.score <= 10);
});
test('Memory rejects duplicate targets, off-grid values and early submissions', () => {
  let s = createGame('memorydle', day, catalog, now);
  s = applyAction(s, { type: 'start' }, catalog, now);
  const targets = s.secret.levels[0].targets;
  assert.throws(() => applyAction(s, { type: 'memory', picks: targets }, catalog, now + 11999));
  assert.throws(() =>
    applyAction(s, { type: 'memory', picks: Array(5).fill(targets[0]) }, catalog, now + 12000),
  );
  s = applyAction(s, { type: 'memory', picks: targets }, catalog, now + 12000);
  assert.equal(s.score, 5);
  assert.equal(s.history.length, 1);
});
test('Music requires valid five-slot answers and completes only after all rounds', () => {
  let s = createGame('chordle', day, catalog, now);
  assert.throws(() =>
    applyAction(s, { type: 'chords', slots: [99, 99, 99, 99, 99] }, catalog, now),
  );
  for (const slots of s.secret.sequences)
    s = applyAction(s, { type: 'chords', slots }, catalog, now);
  assert.equal(s.score, 15);
  assert.equal(s.reward, 150);
});
test('Team answers after the six-second deadline get no point', () => {
  let s = createGame('teamdle', day, catalog, now);
  s = applyAction(s, { type: 'start' }, catalog, now);
  s = applyAction(
    s,
    { type: 'capital', answer: s.secret.countries[0].capital },
    catalog,
    now + 6001,
  );
  assert.equal(s.score, 0);
  assert.equal(s.history[0].correct, false);
});
test('Crosswords require purchase, validate cells and retain progress', () => {
  let s = createGame('crossword', day, catalog, now, catalog.crosswords[0].id);
  assert.throws(() => applyAction(s, { type: 'letter', cell: '0_0', letter: 'ا' }, catalog, now));
  s.puzzle.unlocked = true;
  assert.throws(() =>
    applyAction(s, { type: 'letter', cell: '999_999', letter: 'ا' }, catalog, now),
  );
  for (const [cell, letter] of Object.entries(crosswordSolution(s.secret.crossword)))
    s = applyAction(s, { type: 'letter', cell, letter }, catalog, now);
  s = applyAction(s, { type: 'check' }, catalog, now);
  assert.equal(s.finished, true);
  assert.equal(s.won, true);
});
test('Stale daily attempts do not submit to a new day', () => {
  const s = createGame('factle', day, catalog, now);
  assert.throws(() => applyAction(s, { type: 'guess', skip: true }, catalog, now + 86400000));
});

test('Timers never display an extra second when a start event precedes the next clock tick', () => {
  assert.equal(remaining(100, 10000, 99), 10000);
  assert.equal(remaining(100, 6000, 99), 6000);
  assert.equal(remaining(100, 6000, 6101), 0);
});

test('Every Teamdle pair is a capital and another city from that same country', () => {
  const seen = new Set();
  const capitalPositions = new Set();
  for (let i = 0; i < 365; i++) {
    const s = createGame('teamdle', dateKey(now + i * 86400000), catalog, now);
    for (const round of s.puzzle.rounds) {
      const country = catalog.countries.find((c) => c.id === round.id);
      assert.deepEqual(new Set(round.choices), new Set([country.capital, country.otherCity]));
      assert.equal(round.choices.length, 2);
      assert.notEqual(country.capital, country.otherCity);
      seen.add(country.id);
      capitalPositions.add(round.choices.indexOf(country.capital));
    }
  }
  assert.equal(seen.size, catalog.countries.length);
  assert.equal(capitalPositions.size, 2);
});

test('Iran clock uses Tehran time rather than the browser timezone', () => {
  assert.equal(iranTime('2026-10-30T00:00:00Z'), '۰۳:۳۰:۰۰');
  assert.equal(iranTime('2026-10-30T21:00:00Z'), '۰۰:۳۰:۰۰');
  assert.equal(iranTime('2026-06-30T00:00:00Z'), '۰۳:۳۰:۰۰');
});
