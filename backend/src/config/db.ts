import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Please configure your PostgreSQL connection string in .env');
  }

  const poolConfig: pg.PoolConfig = {
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  // Verified TLS handling if CA certificate is supplied, or standard SSL for cloud poolers
  if (env.DATABASE_CA_CERT_BASE64) {
    const caCert = Buffer.from(env.DATABASE_CA_CERT_BASE64, 'base64').toString('utf8');
    poolConfig.ssl = {
      rejectUnauthorized: true,
      ca: caCert,
    };
  } else if (env.DATABASE_URL.includes('supabase.co') || env.DATABASE_URL.includes('sslmode=require')) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  pool = new Pool(poolConfig);

  pool.on('connect', (client) => {
    // Set schema to routeshield on each connection
    client.query('SET search_path TO routeshield, public;');
  });

  pool.on('error', (err) => {
    console.error('Unexpected database client error:', err.message);
  });

  return pool;
}

export async function query<R extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<R>> {
  const p = getPool();
  return p.query<R>(text, params);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN;');
    await client.query('SET search_path TO routeshield, public;');
    const result = await callback(client);
    await client.query('COMMIT;');
    return result;
  } catch (error) {
    await client.query('ROLLBACK;');
    throw error;
  } finally {
    client.release();
  }
}
