import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('your-db-password') || databaseUrl.includes('your-project')) {
    console.error('Error: DATABASE_URL is not set or contains placeholder credentials in backend/.env');
    console.error('Please configure your real Supabase PostgreSQL connection string in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL database...');
  const poolConfig: pg.PoolConfig = {
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_CA_CERT_BASE64) {
    const caCert = Buffer.from(process.env.DATABASE_CA_CERT_BASE64, 'base64').toString('utf8');
    poolConfig.ssl = { rejectUnauthorized: true, ca: caCert };
  } else if (databaseUrl.includes('supabase.co') || databaseUrl.includes('sslmode=require')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new pg.Pool(poolConfig);
  const client = await pool.connect();

  try {
    const rootDir = path.resolve(__dirname, '../..');
    const mig1Path = path.join(rootDir, 'supabase', 'migrations', '0001_init.sql');
    const mig2Path = path.join(rootDir, 'supabase', 'migrations', '0002_demo_network.sql');

    console.log(`Running migration 0001: ${mig1Path}...`);
    const sql1 = fs.readFileSync(mig1Path, 'utf8');
    await client.query(sql1);
    console.log('✓ Migration 0001_init.sql executed successfully.');

    console.log(`Running migration 0002: ${mig2Path}...`);
    const sql2 = fs.readFileSync(mig2Path, 'utf8');
    await client.query(sql2);
    console.log('✓ Migration 0002_demo_network.sql executed successfully.');

    // Verification
    const nodesRes = await client.query('SELECT count(*) FROM routeshield.nodes;');
    const edgesRes = await client.query('SELECT count(*) FROM routeshield.edges;');
    console.log(`✓ Verification complete:`);
    console.log(`  - Nodes populated: ${nodesRes.rows[0].count}`);
    console.log(`  - Edges populated: ${edgesRes.rows[0].count}`);
  } catch (err: any) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
