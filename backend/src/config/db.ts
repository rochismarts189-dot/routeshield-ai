import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { env } from './env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;
let pgliteInitPromise: Promise<PGlite> | null = null;

export function hasConfiguredDatabaseUrl(): boolean {
  return Boolean(
    env.DATABASE_URL &&
    !env.DATABASE_URL.includes('your-db-password') &&
    !env.DATABASE_URL.includes('your-project')
  );
}

export function getPool(): pg.Pool {
  if (pool) return pool;

  if (!hasConfiguredDatabaseUrl()) {
    throw new Error('DATABASE_URL is not configured for remote PostgreSQL connection');
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

async function getOrInitPGlite(): Promise<PGlite> {
  if (pgliteInstance) return pgliteInstance;
  if (pgliteInitPromise) return pgliteInitPromise;

  pgliteInitPromise = (async () => {
    console.log('[Database] Remote DATABASE_URL not set — initializing embedded PostgreSQL (PGlite)...');
    const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    const dataDir = path.resolve(process.cwd(), '.pglite_data');
    const db = new PGlite(dataDir);

    try {
      // Check if schema and nodes exist
      const checkRes = await db.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'routeshield' AND table_name = 'nodes';"
      );
      if (checkRes.rows.length === 0) {
        console.log('[Database] Initializing routeshield schema and demo network...');
        const candidateRoots = [
          path.resolve(process.cwd(), '..'),
          process.cwd(),
          path.resolve(baseDir, '../../..'),
          path.resolve(baseDir, '../..'),
        ];
        let mig1 = '';
        let mig2 = '';
        for (const root of candidateRoots) {
          const m1 = path.join(root, 'supabase', 'migrations', '0001_init.sql');
          const m2 = path.join(root, 'supabase', 'migrations', '0002_demo_network.sql');
          if (fs.existsSync(m1) && fs.existsSync(m2)) {
            mig1 = m1;
            mig2 = m2;
            break;
          }
        }
        if (mig1 && fs.existsSync(mig1)) {
          await db.exec(fs.readFileSync(mig1, 'utf8'));
        }
        if (mig2 && fs.existsSync(mig2)) {
          await db.exec(fs.readFileSync(mig2, 'utf8'));
        }
        console.log('[Database] Embedded PostgreSQL initialized successfully with demo network.');
      }
    } catch (migErr: any) {
      console.warn('[Database] Schema verification note:', migErr?.message || migErr);
    }

    pgliteInstance = db;
    return db;
  })();

  return pgliteInitPromise;
}

export async function query<R extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<R>> {
  if (hasConfiguredDatabaseUrl()) {
    const p = getPool();
    return p.query<R>(text, params);
  }

  const db = await getOrInitPGlite();
  const result = await db.query(text, params);
  return result as unknown as pg.QueryResult<R>;
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (hasConfiguredDatabaseUrl()) {
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

  const db = await getOrInitPGlite();
  return db.transaction(async (tx) => {
    return callback(tx as any);
  }) as Promise<T>;
}

