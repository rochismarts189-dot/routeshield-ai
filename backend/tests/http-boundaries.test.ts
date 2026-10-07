import { beforeAll, afterAll, it, expect } from 'vitest';
import { app } from '../src/app.js';
import type { Server } from 'node:http';
let server: Server; let base: string;
beforeAll(async () => { server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${(server.address() as any).port}`; });
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
it('allows the configured frontend preflight and rejects unknown origins', async () => {
  const allowed = await fetch(`${base}/api/reports`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' } });
  expect(allowed.status).toBe(204); expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'https://unknown.example' } });
  expect(denied.status).toBe(403); expect((await denied.json() as any).error.code).toBe('CORS_ORIGIN_DENIED');
});
it('returns JSON validation/not-found errors and throttles authentication attempts', async () => {
  const missing = await fetch(`${base}/api/does-not-exist`); expect(missing.status).toBe(404); expect(missing.headers.get('content-type')).toContain('application/json');
  const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  expect(malformed.status).toBe(400); expect((await malformed.json() as any).error.code).toBe('INVALID_JSON');
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); expect(response.status).toBe(400);
  }
  const limited = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); expect(limited.status).toBe(429);
});
