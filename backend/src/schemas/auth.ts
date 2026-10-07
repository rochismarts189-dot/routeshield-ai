import { z } from 'zod';

// Explicit UTF-8 byte length validator for bcrypt's 72-byte truncation limit
function checkBcryptByteLimit(val: string): boolean {
  return Buffer.byteLength(val, 'utf8') <= 72;
}

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Email must be at least 3 characters')
    .max(254, 'Email must not exceed 254 characters')
    .email('Invalid email address format'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(80, 'Display name must not exceed 80 characters'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must not exceed 128 characters')
    .refine(checkBcryptByteLimit, {
      message: 'Password exceeds 72-byte limit for cryptographic hashing',
    }),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1, 'Password is required').max(128).refine(checkBcryptByteLimit),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
