import { readFile, writeFile } from 'node:fs/promises';
const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(await read('data/catalog.json'));
catalog.crosswords.push(...JSON.parse(await read('data/crosswords-archive.json')));
// Dollar-quoted JSON is unambiguous even with Persian apostrophes and punctuation.
const json = JSON.stringify(catalog);
if (json.includes('$catalog$')) throw new Error('Invalid delimiter in content');
const sql =
  (
    await Promise.all(
      [
        'supabase/classic-schema.sql',
        'supabase/classic-actions.sql',
        'supabase/classic-accounts.sql',
        'supabase/classic-compatibility.sql',
      ].map(read),
    )
  ).join('\n') +
  '\ninsert into classic_private.content(singleton,data) values(true,$catalog$' +
  json +
  '$catalog$::jsonb) on conflict(singleton) do update set data=excluded.data;\ncommit;\n';
await writeFile(new URL('../supabase/upgrade.sql', import.meta.url), sql);
console.log('Prepared supabase/upgrade.sql for review. No database connection was made.');
