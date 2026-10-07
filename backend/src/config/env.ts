import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

dotenv.config();
const optionalSetting = z.preprocess(value => value === '' ? undefined : value, z.string().trim().optional());
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  FRONTEND_URL: z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value,
    z.string().trim().url().optional().transform(value => value?.replace(/\/$/, ''))),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: optionalSetting, DATABASE_CA_CERT_BASE64: optionalSetting,
  JWT_SECRET: optionalSetting,
  JWT_ISSUER: z.string().default('routeshield-api'),
  JWT_AUDIENCE: z.string().default('routeshield-web'),
  GEMINI_API_KEY: optionalSetting,
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  SUPABASE_URL: optionalSetting, SUPABASE_SECRET_KEY: optionalSetting,
  SUPABASE_STORAGE_BUCKET: z.string().default('evidence'),
}).superRefine((data, ctx) => {
  if (data.DATABASE_URL) {
    try {
      const url = new URL(data.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
    } catch { ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Use a valid PostgreSQL connection URL.' }); }
  }
  if (data.SUPABASE_URL) {
    try { new URL(data.SUPABASE_URL); }
    catch { ctx.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Use a valid Supabase project URL.' }); }
  }
  if (data.NODE_ENV === 'production') {
    for (const key of ['DATABASE_URL', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET'] as const) {
      if (!data[key] || /your-|replace-with|placeholder|development-secret/.test(data[key]!)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'A real backend setting is required in production.' });
      }
    }
    if (!data.JWT_SECRET || Buffer.byteLength(data.JWT_SECRET) < 32) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Use at least 32 random bytes for JWT_SECRET.' });
    }
    const frontend = data.FRONTEND_URL ? new URL(data.FRONTEND_URL) : null;
    if (frontend && (frontend.origin !== data.FRONTEND_URL || frontend.protocol !== 'https:')) {
      ctx.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'Set the exact HTTPS frontend origin in production.' });
    }
  }
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Backend configuration invalid: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
export const env = {
  ...parsed.data,
  FRONTEND_URL: parsed.data.FRONTEND_URL ?? (parsed.data.NODE_ENV === 'production' ? undefined : 'http://localhost:5173'),
  JWT_SECRET: parsed.data.JWT_SECRET || randomBytes(32).toString('hex'),
};
