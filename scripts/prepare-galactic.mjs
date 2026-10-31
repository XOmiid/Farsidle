import { readFile, writeFile } from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const players = JSON.parse(await read('data/galactic/players.json')),
  config = JSON.parse(await read('data/galactic/config.json'));
if (
  new Set(players.map((p) => p.id)).size !== players.length ||
  players.length < 88 ||
  !/^galactic-v[0-9]+$/.test(config.version)
)
  throw new Error('Invalid player pool/version');
const sources = {
  ratings: 'Farsidle editorial gameplay traits; not EA or official ratings',
  rosterAsOf: '2026-10-30',
  traitsUpdated: '2026-10-31',
  notes: await read('data/galactic/README.md'),
};
const quote = (value) => {
  const json = JSON.stringify(value);
  if (json.includes('$galactic$')) throw new Error('Unsafe content delimiter');
  return '$galactic$' + json + '$galactic$::jsonb';
};
const files = ['schema', 'engine', 'rooms', 'realtime'];
const seed = `update galactic_private.datasets set active=false where active and version<>'${config.version}';
insert into galactic_private.datasets(version,players,config,sources,active)values('${config.version}',${quote(players)},${quote(config)},${quote(sources)},true)on conflict(version)do nothing;
update galactic_private.datasets set active=true where version='${config.version}';
with upgraded as(update galactic_private.rooms set dataset_version='${config.version}',version=version+1 where phase='lobby' and dataset_version<> '${config.version}' returning id)update galactic_private.members set ready=false where room_id in(select id from upgraded);`;
const sql =
  'begin;\n' +
  (await Promise.all(files.map((f) => read('supabase/galactic-' + f + '.sql')))).join('\n') +
  '\n' +
  seed +
  '\ncommit;\n';
await writeFile(new URL('../supabase/galactic-upgrade.sql', import.meta.url), sql);
console.log('Prepared additive Galactic upgrade. No database connection made.');
