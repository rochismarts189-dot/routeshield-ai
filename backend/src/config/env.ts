import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional().default(''),
  DATABASE_CA_CERT_BASE64: z.string().optional(),
  JWT_SECRET: z.string().min(16).default('development-secret-key-at-least-32-chars-long-for-jwt-security!'),
  JWT_ISSUER: z.string().default('routeshield-api'),
  JWT_AUDIENCE: z.string().default('routeshield-web'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('evidence'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const env = parsed.data;
