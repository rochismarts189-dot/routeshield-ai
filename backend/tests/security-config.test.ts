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
  it('rejects production startup without real backend secrets and an HTTPS frontend', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'production' }).success).toBe(false);
  });
  it('rejects bcrypt truncation and public role injection', () => {
    const fields = { email: 'test@example.test', displayName: 'Test', password: '123456789012' };
    expect(registerSchema.safeParse({ ...fields, password: '💚'.repeat(30) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...fields, role: 'MODERATOR' }).success).toBe(false);
  });
});
