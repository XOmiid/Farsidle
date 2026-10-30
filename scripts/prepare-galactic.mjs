import { readFile, writeFile } from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const players = JSON.parse(await read('data/galactic/players.json')),
  config = JSON.parse(await read('data/galactic/config.json'));
if (new Set(players.map((p) => p.id)).size !== players.length || players.length < 88)
  throw new Error('Invalid player pool');
const sources = {
  ratings: 'Farsidle original custom estimates; not EA or official ratings',
  rosterAsOf: '2026-10-30',
  notes: await read('data/galactic/README.md'),
};
const quote = (value) => {
  const json = JSON.stringify(value);
  if (json.includes('$galactic$')) throw new Error('Unsafe content delimiter');
  return '$galactic$' + json + '$galactic$::jsonb';
};
const files = ['schema', 'engine', 'rooms', 'realtime'];
const sql =
  'begin;\n' +
  (await Promise.all(files.map((f) => read('supabase/galactic-' + f + '.sql')))).join('\n') +
  '\ninsert into galactic_private.datasets(version,players,config,sources,active)values(' +
  "'" +
  config.version +
  "'," +
  quote(players) +
  ',' +
  quote(config) +
  ',' +
  quote(sources) +
  ',true)on conflict(version)do nothing;\ncommit;\n';
await writeFile(new URL('../supabase/galactic-upgrade.sql', import.meta.url), sql);
console.log('Prepared additive Galactic upgrade. No database connection made.');
