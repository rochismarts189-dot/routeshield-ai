import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import type { Server } from 'node:http';

vi.mock('../src/config/env.js', () => ({ env: {
  NODE_ENV: 'production', FRONTEND_URL: undefined, TRUST_PROXY_HOPS: 1,
  JWT_SECRET: 'test-only-secret-'.repeat(4), JWT_ISSUER: 'routeshield-api', JWT_AUDIENCE: 'routeshield-web',
} }));
import { app } from '../src/app.js';

let server: Server; let base: string;
beforeAll(async () => {
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

it('permits backend-first health checks but denies browser origins until Vercel is configured', async () => {
  expect((await fetch(`${base}/api/health`)).status).toBe(200);
  for (const origin of ['http://localhost:5173', 'https://routeshield-backend.onrender.com', 'https://demo.vercel.app']) {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBe(null);
  }
});
