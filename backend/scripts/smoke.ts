import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import assert from 'node:assert/strict';
async function main() {
  const { SMOKE_API_URL, SMOKE_FRONTEND_ORIGIN, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_PHOTO_PATH } = process.env;
  if (![SMOKE_API_URL, SMOKE_FRONTEND_ORIGIN, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_PHOTO_PATH].every(Boolean)) throw new Error('Configure SMOKE_API_URL, SMOKE_FRONTEND_ORIGIN, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_PHOTO_PATH privately first.');
  const base = SMOKE_API_URL!.replace(/\/$/, '');
  assert.equal(new URL(base).protocol, 'https:', 'Live smoke target must be HTTPS');
  async function call(path: string, options: RequestInit = {}) {
    const response = await fetch(`${base}/api${path}`, { ...options, signal: AbortSignal.timeout(90000) });
    assert.equal(response.status < 400, true, `API check failed (${response.status}) at ${path}`);
    return { data: await response.json() as any, response };
  }
  assert.equal((await call('/health')).data.status, 'ok');
  assert.equal((await call('/ready')).data.status, 'ready');
  const network = await call('/network', { headers: { Origin: SMOKE_FRONTEND_ORIGIN! } });
  assert.equal(network.response.headers.get('access-control-allow-origin'), SMOKE_FRONTEND_ORIGIN);
  assert.equal(network.data.nodes.length, 8); assert.equal(network.data.edges.length, 10);
  const denied = await fetch(`${base}/api/network`, { headers: { Origin: 'https://unapproved.example' }, signal: AbortSignal.timeout(90000) }); assert.equal(denied.status, 403);
  const login = await call('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }) });
  const token = login.data.token; assert.equal(typeof token, 'string');
  const headers = { Authorization: `Bearer ${token}` }; await call('/auth/me', { headers });
  const unauthorized = await fetch(`${base}/api/auth/me`, { headers: { Authorization: 'Bearer invalid' }, signal: AbortSignal.timeout(90000) }); assert.equal(unauthorized.status, 401);
  const form = new FormData(); const bytes = readFileSync(SMOKE_PHOTO_PATH!);
  form.set('photo', new Blob([new Uint8Array(bytes)], { type: /\.png$/i.test(SMOKE_PHOTO_PATH!) ? 'image/png' : 'image/jpeg' }), basename(SMOKE_PHOTO_PATH!));
  form.set('edgeId', 'BC'); form.set('claim', 'BLOCKED'); form.set('description', 'Authorized hackathon evidence fixture'); form.set('observedAt', new Date().toISOString());
  const created = await call('/reports', { method: 'POST', headers, body: form });
  assert.equal(created.data.analysisStatus, 'COMPLETE', 'Live Gemini analysis did not complete'); assert.ok(created.data.analysis?.observations?.length, 'No validated visual observations');
  const incident = (await call(`/incidents/${created.data.incidentId}`)).data.incident;
  const report = incident.reports.find((item: any) => item.id === created.data.reportId);
  assert.equal(report.analysisStatus, 'COMPLETE'); assert.ok(report.signedPhotoUrl, 'Private evidence signing failed');
  const image = await fetch(report.signedPhotoUrl, { signal: AbortSignal.timeout(20000) }); assert.equal(image.status, 200);
  for (const profile of ['GENERAL_WALK', 'STEP_FREE']) {
    const planned = await call('/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originId: 'A', destinationId: 'D', profile }) });
    assert.ok(['OK','NO_ROUTE'].includes(planned.data.status)); assert.ok(planned.data.explanation);
    console.log(`${profile}: ${planned.data.status}${planned.data.route ? `, ${planned.data.route.distanceMeters}m` : ''}`);
  }
  console.log('PASS: HTTPS API, database/private storage, exact CORS, JWT auth, real Gemini upload, persisted evidence and both routing profiles.');
}
main().catch((err: Error) => { console.error(`FAIL: ${err.message}`); process.exitCode = 1; });
