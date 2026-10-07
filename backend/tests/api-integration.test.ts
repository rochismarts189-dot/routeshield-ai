import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import sharp from 'sharp';

// Isolated test doubles only: application production code has no embedded DB or fake AI mode.
const state = vi.hoisted(() => ({ db: null as any, analysis: null as any, fail: false, photos: new Map<string, Buffer>() }));
vi.mock('../src/config/db.js', () => ({
  query: async (sql: string, params?: unknown[]) => state.db.query(sql, params),
  withTransaction: async (callback: any) => state.db.transaction(async (tx: any) => callback({ query: (sql: string, params?: unknown[]) => tx.query(sql, params) })),
}));
vi.mock('../src/config/storage.js', () => ({
  uploadEvidencePhoto: async (key: string, bytes: Buffer) => { state.photos.set(key, bytes); },
  removeEvidencePhoto: async (key: string) => { state.photos.delete(key); },
  getEvidencePhotoBuffer: async (key: string) => state.photos.get(key),
  getSignedPhotoUrl: async (key: string) => `https://example.test/${key}`,
  verifyPrivateEvidenceBucket: async () => {},
}));
vi.mock('../src/services/gemini.js', () => ({ analyzeEvidencePhoto: async (params: any) => {
  await params.beforeAttempt?.();
  return { success: !state.fail, model: 'test-fixture-model', analysis: state.fail ? null : state.analysis,
    errorCode: state.fail ? 'TEST_PROVIDER_FAILURE' : null, errorMessage: null };
} }));
// Rate-limit configuration is tested separately from this isolated SQL/HTTP workflow.
vi.mock('express-rate-limit', () => ({ default: () => (_req: any, _res: any, next: any) => next() }));
import { app } from '../src/app.js';
import { hashPassword } from '../src/repositories/users.js';

const block = { obstruction_type: 'CONSTRUCTION_BARRIER', severity: 'HIGH', visible_extent: 'FULL_WIDTH',
  passability: { general_walk: 'BLOCKED', step_free: 'BLOCKED' }, evidence_quality: 'CLEAR', description_consistency: 'SUPPORTS',
  observations: ['Test fixture: barrier spans the path'], confidence: .9, uncertainty_reasons: [] };
const clear = { ...block, obstruction_type: 'NONE', severity: 'LOW', visible_extent: 'NONE',
  passability: { general_walk: 'APPEARS_CLEAR', step_free: 'APPEARS_CLEAR' }, observations: ['Test fixture: visible area clear'] };
let server: Server;
let base: string;
let color = 0;
async function http(path: string, method = 'GET', body?: any, token?: string) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() as any };
}
async function register(name: string) {
  const result = await http('/auth/register', 'POST', { email: `${name}@example.test`, displayName: name, password: 'test-password-only-123' });
  expect(result.status).toBe(201); return result.data;
}
async function upload(token: string, claim = 'BLOCKED', edgeId = 'BC', image?: Buffer, incidentId?: string) {
  const bytes = image || await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: ++color * 12, g: 20, b: 40 } } }).jpeg().toBuffer();
  const form = new FormData();
  form.set('photo', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'test.jpg');
  form.set('edgeId', edgeId); form.set('claim', claim); form.set('description', 'Isolated integration test fixture');
  form.set('observedAt', new Date().toISOString()); if (incidentId) form.set('incidentId', incidentId);
  return http('/reports', 'POST', form, token);
}
async function plan(profile = 'STEP_FREE') { return http('/routes/plan', 'POST', { originId: 'A', destinationId: 'D', profile }); }

beforeAll(async () => {
  state.db = new PGlite();
  for (const name of ['0001_init.sql', '0002_demo_network.sql', '0003_real_navigation.sql']) await state.db.exec(readFileSync(resolve('../supabase/migrations', name), 'utf8'));
  server = await new Promise<Server>(resolveServer => { const s = app.listen(0, '127.0.0.1', () => resolveServer(s)); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
}, 20000);
afterAll(async () => { if (server) await new Promise<void>(resolveClose => server.close(() => resolveClose())); await state.db?.close(); });
beforeEach(async () => { await state.db.exec('TRUNCATE routeshield.incident_events, routeshield.reports, routeshield.incidents, routeshield.users RESTART IDENTITY CASCADE'); state.analysis = block; state.fail = false; state.photos.clear(); color = 0; });

describe('Express + PostgreSQL migration integration', () => {
  it('authenticates with bcrypt/JWT and prevents public moderator escalation', async () => {
    const first = await register('alice');
    expect(first.user.role).toBe('USER');
    expect((await http('/auth/me', 'GET', undefined, first.token)).data.user.id).toBe(first.user.id);
    expect((await http('/auth/me', 'GET', undefined, 'invalid')).status).toBe(401);
    expect((await http('/auth/login', 'POST', { email: 'alice@example.test', password: 'wrong' })).status).toBe(401);
    expect((await http('/auth/login', 'POST', { email: 'alice@example.test', password: 'test-password-only-123' })).status).toBe(200);
    expect((await http('/auth/register', 'POST', { email: 'evil@example.test', displayName: 'evil', password: 'test-password-only-123', role: 'MODERATOR' })).status).toBe(400);
    expect((await http('/incidents/not-a-uuid')).status).toBe(400);
    const stored = (await state.db.query('SELECT password_hash FROM routeshield.users')).rows[0].password_hash;
    expect(stored).toMatch(/^\$2[ab]\$/);
  });

  it('persists evidence, corroborates distinct accounts, keeps conflicts blocked, and reopens only on verified fresh clearance', async () => {
    const one = await register('one'); const two = await register('two');
    const moderatorHash = await hashPassword('test-moderator-only-123');
    await state.db.query("INSERT INTO routeshield.users(email,display_name,password_hash,role) VALUES($1,$2,$3,'MODERATOR')", ['mod@example.test', 'Moderator', moderatorHash]);
    const mod = (await http('/auth/login', 'POST', { email: 'mod@example.test', password: 'test-moderator-only-123' })).data;
    expect((await plan()).data.route.distanceMeters).toBe(460);
    const first = await upload(one.token); expect(first.status).toBe(201); expect(first.data.analysisStatus).toBe('COMPLETE');
    const id = first.data.incidentId;
    expect(first.data.incidentStatus).toBe('UNVERIFIED');
    expect((await plan()).data.route.distanceMeters).toBe(740); // precautionary step-free avoidance
    expect((await plan('GENERAL_WALK')).data.route.distanceMeters).toBe(460);
    await upload(one.token); // same account cannot supply two independent votes
    expect((await http(`/incidents/${id}`)).data.incident.status).toBe('UNVERIFIED');
    const second = await upload(two.token); expect(second.data.incidentStatus).toBe('CONFIRMED_BLOCKED');
    expect((await plan('GENERAL_WALK')).data.route.distanceMeters).toBe(620);
    expect((await plan()).data.route.distanceMeters).toBe(740);
    let detail = (await http(`/incidents/${id}`)).data.incident;
    expect(detail.reports.every((r: any) => r.analysisAttempts === 1)).toBe(true);
    expect((await http(`/incidents/${id}/verify`, 'POST', { action: 'DISMISS', expectedVersion: detail.version, reason: 'test' }, one.token)).status).toBe(403);
    state.analysis = clear;
    const clearResult = await upload(two.token, 'CLEAR', 'BC', undefined, id);
    expect(clearResult.data.incidentStatus).toBe('CONFIRMED_BLOCKED');
    detail = (await http(`/incidents/${id}`)).data.incident;
    expect(detail.disputed).toBe(true); expect(detail.requiresReview).toBe(true);
    expect((await plan()).data.route.distanceMeters).toBe(740);
    const input = { action: 'CLEAR', expectedVersion: detail.version, evidenceReportId: clearResult.data.reportId, attestation: true, reason: 'Entire demonstration segment checked' };
    expect((await http(`/incidents/${id}/verify`, 'POST', { ...input, attestation: false }, mod.token)).status).toBe(400);
    expect((await http(`/incidents/${id}/verify`, 'POST', { ...input, expectedVersion: 1 }, mod.token)).status).toBe(409);
    expect((await http(`/incidents/${id}/verify`, 'POST', { ...input, evidenceReportId: first.data.reportId }, mod.token)).status).toBe(400);
    const reopened = await http(`/incidents/${id}/verify`, 'POST', input, mod.token);
    expect(reopened.status).toBe(200); expect(reopened.data.incident.confirmedAt).toBeTruthy();
    expect((await plan()).data.route.distanceMeters).toBe(460);
    expect((await http(`/incidents/${id}/verify`, 'POST', { ...input, expectedVersion: reopened.data.incident.version }, mod.token)).status).toBe(409);
    expect((await upload(one.token, 'BLOCKED', 'BC', undefined, id)).status).toBe(409);
    const events = (await http(`/incidents/${id}`)).data.incident.events;
    expect(events.some((e: any) => e.reasonCode === 'COMMUNITY_CORROBORATION')).toBe(true);
    expect(events.some((e: any) => e.reasonCode === 'MODERATOR_CLEARED')).toBe(true);
  });

  it('rejects corrupt/duplicate uploads and persists failed AI without inventing a blockage', async () => {
    const one = await register('upload');
    expect((await upload(one.token, 'BLOCKED', 'BC', Buffer.from('not an image'))).status).toBe(400);
    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).jpeg().toBuffer();
    state.fail = true;
    const result = await upload(one.token, 'BLOCKED', 'BC', image);
    expect(result.data.analysisStatus).toBe('FAILED'); expect(result.data.analysis).toBeNull();
    expect((await plan()).data.route.distanceMeters).toBe(460);
    expect((await upload(one.token, 'BLOCKED', 'BC', image)).status).toBe(409);
    state.fail = false;
    const retry = await http(`/reports/${result.data.reportId}/retry-analysis`, 'POST', undefined, one.token);
    expect(retry.data.analysisStatus).toBe('COMPLETE');
    expect((await http(`/reports/${result.data.reportId}/retry-analysis`, 'POST', undefined, one.token)).status).toBe(409);
    const detail = (await http(`/incidents/${result.data.incidentId}`)).data.incident;
    expect(detail.reports[0].analysisAttempts).toBe(2);
  });

  it('returns NO_ROUTE using the actual seeded SQL network when BC and GH are confirmed blocked', async () => {
    const user = await register('network');
    for (const edge of ['BC', 'GH']) await state.db.query("INSERT INTO routeshield.incidents(edge_id,created_by,status,blocked_general,blocked_step_free,confirmed_at) VALUES($1,$2,'CONFIRMED_BLOCKED',true,true,now())", [edge, user.user.id]);
    const result = await plan(); expect(result.status).toBe(200); expect(result.data.status).toBe('NO_ROUTE'); expect(result.data.route).toBeNull();
    expect((await plan('GENERAL_WALK')).data.route.distanceMeters).toBe(620);
  });
  it('isolates real-location evidence from Maple Ward, corroborates and enforces verified reopening', async () => {
    const one = await register('real-one'); const two = await register('real-two');
    async function realUpload(token: string, claim = 'BLOCKED', incidentId?: string) {
      const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: ++color * 12, g: 32, b: 12 } } }).jpeg().toBuffer();
      const form = new FormData(); form.set('photo', new Blob([new Uint8Array(bytes)], {type:'image/jpeg'}), 'isolated-test.jpg');
      form.set('label','Isolated test location'); form.set('latitude','17.7'); form.set('longitude','83.3');
      form.set('claim',claim); form.set('observedAt',new Date().toISOString()); if (incidentId) form.set('incidentId',incidentId);
      return http('/navigation/reports','POST',form,token);
    }
    expect((await http('/navigation/plan','POST',{origin:'origin',destination:'destination'})).status).toBe(401);
    expect((await http('/navigation/status')).data.configured).toBe(false);
    const first = await realUpload(one.token); expect(first.status).toBe(201); expect(first.data.incidentStatus).toBe('UNVERIFIED');
    const second = await realUpload(two.token); expect(second.data.incidentId).toBe(first.data.incidentId); expect(second.data.incidentStatus).toBe('CONFIRMED_BLOCKED');
    expect((await plan()).data.route.distanceMeters).toBe(460);
    expect((await http('/incidents')).data.incidents).toHaveLength(0);
    const real = (await http('/navigation/incidents')).data.incidents; expect(real).toHaveLength(1); expect(real[0].lat).toBe(17.7);
    const hash = await hashPassword('real-test-moderator-123');
    await state.db.query("INSERT INTO routeshield.users(email,display_name,password_hash,role) VALUES($1,$2,$3,'MODERATOR')",['realmod@example.test','Real moderator',hash]);
    const mod = (await http('/auth/login','POST',{email:'realmod@example.test',password:'real-test-moderator-123'})).data;
    state.analysis = clear;
    const clearance = await realUpload(two.token,'CLEAR',real[0].id);
    let detail = (await http(`/navigation/incidents/${real[0].id}`,'GET',undefined,one.token)).data.incident;
    expect(detail.disputed).toBe(true); expect(detail.status).toBe('CONFIRMED_BLOCKED');
    const payload = {action:'CLEAR',expectedVersion:detail.version,evidenceReportId:clearance.data.reportId,reason:'Isolated test full-path review',attestation:true};
    expect((await http(`/navigation/incidents/${real[0].id}/verify`,'POST',payload,one.token)).status).toBe(403);
    expect((await http(`/navigation/incidents/${real[0].id}/verify`,'POST',{...payload,attestation:false},mod.token)).status).toBe(400);
    expect((await http(`/navigation/incidents/${real[0].id}/verify`,'POST',payload,mod.token)).status).toBe(200);
    expect((await http('/navigation/incidents')).data.incidents).toHaveLength(0);
    expect((await plan()).data.route.distanceMeters).toBe(460);
  });

});
