import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { splitSql } from '../src/lib/split-sql.mjs';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your Neon PostgreSQL connection string.');
const sql = neon(process.env.DATABASE_URL);
const folder = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(folder)).filter(f => f.endsWith('.sql')).sort()) {
 const source = await readFile(new URL(file, folder), 'utf8');
 await sql.transaction(splitSql(source).filter(s => !['BEGIN','COMMIT'].includes(s)).map(statement => sql(statement)));
 console.log(`Applied ${file}`);
}
