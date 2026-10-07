import pg from 'pg';
import { env } from './env.js';
import { AppError } from '../lib/errors.js';

let pool: pg.Pool | null = null;
export function createPoolConfig(databaseUrl: string, caBase64?: string): pg.PoolConfig {
  const url = new URL(databaseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode === 'no-verify' || (!local && sslMode === 'disable')) {
    throw new Error('Remote PostgreSQL requires verified TLS. Configure the database CA certificate if necessary.');
  }
  // Connection-string SSL options must not override the verified ssl object.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'uselibpqcompat']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(), max: 5,
    idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000,
    ssl: local && !caBase64 && !sslMode ? false : {
      rejectUnauthorized: true,
      ...(caBase64 ? { ca: Buffer.from(caBase64, 'base64').toString('utf8') } : {}),
    },
  };
}
export function getPool(): pg.Pool {
  if (!env.DATABASE_URL) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Configure backend DATABASE_URL and apply the Supabase migrations.');
  if (!pool) {
    pool = new pg.Pool(createPoolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT_BASE64));
    pool.on('error', () => console.error('[database] An idle connection failed.'));
  }
  return pool;
}
export async function query<R extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<R>> {
  return getPool().query<R>(text, params);
}
export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function closePool(): Promise<void> { await pool?.end(); pool = null; }
