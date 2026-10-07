import { closePool } from '../src/config/db.js';
import dotenv from 'dotenv';
import { createUser, findUserByEmail, hashPassword } from '../src/repositories/users.js';

dotenv.config();

async function main() {
  const email = process.env.MODERATOR_EMAIL;
  const password = process.env.MODERATOR_PASSWORD;
  const displayName = process.env.MODERATOR_DISPLAY_NAME || 'RouteShield Moderator';

  if (!email || !password) {
    console.error('Error: MODERATOR_EMAIL and MODERATOR_PASSWORD environment variables must be provided.');
    console.error('Usage: MODERATOR_EMAIL=... MODERATOR_PASSWORD=... npm run create-moderator');
    process.exit(1);
  }

  if (password.length < 12 || password.length > 128 || Buffer.byteLength(password) > 72) {
    console.error('Error: MODERATOR_PASSWORD must be between 12 and 128 characters.');
    process.exit(1);
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`User with email "${email}" already exists (Role: ${existing.role}).`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  const created = await createUser({
    email,
    displayName,
    passwordHash,
    role: 'MODERATOR',
  });

  console.log(`Moderator account successfully created:`);
  console.log(`  ID: ${created.id}`);
  console.log(`  Email: ${created.email}`);
  console.log(`  Display Name: ${created.display_name}`);
  console.log(`  Role: ${created.role}`);
  console.log(`\nNote: Please clear MODERATOR_PASSWORD from your environment.`);
  process.exit(0);
}

main().catch(() => { console.error('Moderator creation failed. Check database configuration and credentials.'); process.exitCode = 1; }).finally(closePool);
