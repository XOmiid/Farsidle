import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalize, crosswordSolution } from '../lib/classic/rules.mjs';
const data = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
assert(data.words.length >= 200, 'At least 200 words');
assert.equal(
  new Set(data.words.map(normalize)).size,
  data.words.length,
  'Canonical words must be unique',
);
for (const word of data.words) {
  assert(/^[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]{4,7}$/.test(word), 'Invalid word: ' + word);
}
assert(data.colors.length >= 40);
assert.equal(new Set(data.colors.map((c) => c.hex.toLowerCase())).size, data.colors.length);
for (const color of data.colors) assert(/^#[0-9a-f]{6}$/i.test(color.hex));
assert(data.countries.length >= 60);
assert.equal(new Set(data.countries.map((c) => c.id)).size, data.countries.length);
assert.equal(new Set(data.countries.map((c) => normalize(c.name))).size, data.countries.length);
for (const c of data.countries) {
  assert(
    c.otherCity && normalize(c.otherCity) !== normalize(c.capital),
    'A distinct same-country city is required: ' + c.id,
  );
  assert(c.capital && c.facts.length >= 2 && new Set(c.facts).size === c.facts.length);
  assert(new URL(c.source).protocol === 'https:');
}
assert(data.chords.length >= 24);
assert.equal(new Set(data.chords.map((c) => c.name)).size, data.chords.length);
for (const chord of data.chords)
  assert(
    chord.notes.length >= 3 && chord.notes.every((n) => Number.isInteger(n) && n >= 36 && n <= 96),
  );
assert(data.crosswords.length >= 4);
for (const puzzle of data.crosswords) {
  const cells = crosswordSolution(puzzle);
  const black = new Set(puzzle.blackCells.map(([r, c]) => r + '_' + c));
  assert.equal(
    new Set(puzzle.slots.map((s) => s.number + ':' + s.direction)).size,
    puzzle.slots.length,
  );
  for (let r = 0; r < puzzle.rows; r++)
    for (let c = 0; c < puzzle.cols; c++)
      assert(
        black.has(r + '_' + c) !== Boolean(cells[r + '_' + c]),
        'Every white cell must be covered: ' + puzzle.id + ' ' + r + '_' + c,
      );
  for (const cell of Object.keys(cells)) {
    const [r, c] = cell.split('_').map(Number);
    assert(r >= 0 && r < puzzle.rows && c >= 0 && c < puzzle.cols);
    assert(!black.has(cell));
  }
  assert(puzzle.cost > 0);
}
console.log(
  JSON.stringify(
    {
      words: data.words.length,
      colors: data.colors.length,
      countries: data.countries.length,
      facts: data.countries.reduce((n, c) => n + c.facts.length, 0),
      chords: data.chords.length,
      crosswords: data.crosswords.length,
    },
    null,
    2,
  ),
);
