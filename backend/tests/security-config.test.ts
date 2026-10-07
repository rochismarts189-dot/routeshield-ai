import { describe, it, expect } from 'vitest';
import { createPoolConfig } from '../src/config/db.js';
import { envSchema } from '../src/config/env.js';
import { registerSchema } from '../src/schemas/auth.js';
describe('Backend security configuration', () => {
  it('validates TLS on remote databases and rejects explicitly insecure settings', () => {
    expect(createPoolConfig('postgresql://user:password@db.example.test:5432/postgres?sslmode=require').ssl).toEqual({ rejectUnauthorized: true });
    expect(createPoolConfig('postgresql://user:password@localhost:5432/postgres').ssl).toBe(false);
    expect(() => createPoolConfig('postgresql://user:password@db.example.test/postgres?sslmode=no-verify')).toThrow();
    expect(() => createPoolConfig('postgresql://user:password@db.example.test/postgres?sslmode=disable')).toThrow();
  });
  it('rejects production startup without real backend secrets', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'production' }).success).toBe(false);
  });
  it('allows backend-first deployment but rejects an insecure configured frontend', () => {
    const settings = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://server:password@db.example.test/postgres',
      SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'test-storage-secret',
      GEMINI_API_KEY: 'test-gemini-key', JWT_SECRET: 'x'.repeat(64) };
    expect(envSchema.safeParse(settings).success).toBe(true);
    expect(envSchema.safeParse({ ...settings, FRONTEND_URL: '' }).success).toBe(true);
    expect(envSchema.safeParse({ ...settings, FRONTEND_URL: 'http://localhost:5173' }).success).toBe(false);
    expect(envSchema.safeParse({ ...settings, FRONTEND_URL: 'https://demo.vercel.app/plan' }).success).toBe(false);
    expect(envSchema.safeParse({ ...settings, FRONTEND_URL: 'https://demo.vercel.app' }).success).toBe(true);
  });
  it('rejects bcrypt truncation and public role injection', () => {
    const fields = { email: 'test@example.test', displayName: 'Test', password: '123456789012' };
    expect(registerSchema.safeParse({ ...fields, password: '💚'.repeat(30) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...fields, role: 'MODERATOR' }).success).toBe(false);
  });
});
