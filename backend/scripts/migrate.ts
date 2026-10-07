import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../src/config/db.js';

async function main() {
  const client = await getPool().connect();
  try {
    const migrationsDir = path.resolve(process.cwd(), '../supabase/migrations');
    for (const name of fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
      await client.query('BEGIN');
      try { await client.query(fs.readFileSync(path.join(migrationsDir, name), 'utf8')); await client.query('COMMIT'); }
      catch (err) { await client.query('ROLLBACK'); throw err; }
      console.log(`Applied ${name}`);
    }
    const result = await client.query('SELECT (SELECT count(*) FROM routeshield.nodes) AS nodes, (SELECT count(*) FROM routeshield.edges) AS edges');
    if (Number(result.rows[0].nodes) !== 8 || Number(result.rows[0].edges) !== 10) throw new Error('Demo network verification failed');
    console.log('Verified Maple Ward: 8 nodes, 10 edges.');
  } finally { client.release(); await closePool(); }
}
main().catch(() => { console.error('Migration failed. Check the verified TLS connection, permissions, and SQL migrations.'); process.exitCode = 1; });
