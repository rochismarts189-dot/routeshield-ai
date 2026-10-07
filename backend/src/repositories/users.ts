import bcryptjs from 'bcryptjs';
import { query } from '../config/db.js';

export interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: 'USER' | 'MODERATOR';
  created_at: string;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(plain, hash);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const res = await query<UserRecord>(
    `SELECT id, email, display_name, password_hash, role, created_at
     FROM routeshield.users
     WHERE email = $1
     LIMIT 1;`,
    [email.toLowerCase().trim()]
  );
  return res.rows[0] || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const res = await query<UserRecord>(
    `SELECT id, email, display_name, password_hash, role, created_at
     FROM routeshield.users
     WHERE id = $1
     LIMIT 1;`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createUser(data: {
  email: string;
  displayName: string;
  passwordHash: string;
  role?: 'USER' | 'MODERATOR';
}): Promise<UserRecord> {
  const res = await query<UserRecord>(
    `INSERT INTO routeshield.users (email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, password_hash, role, created_at;`,
    [
      data.email.toLowerCase().trim(),
      data.displayName.trim(),
      data.passwordHash,
      data.role || 'USER',
    ]
  );
  return res.rows[0];
}
