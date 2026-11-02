/**
 * Creates an administrator on an existing database (only administrators can create staff, so the
 * first one has to come from here). Never changes an existing account.
 *   MONGO_URI=<database> npx tsx apps/api/scripts/create-admin.ts admin@example.com
 * The password comes from ADMIN_PASSWORD, or a strong one is generated and printed once.
 */
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Usage: create-admin.ts <email>');
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI');

  const password = process.env.ADMIN_PASSWORD || `${randomBytes(12).toString('base64url')}!7a`;
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await User.findOne({ email }).select('role').lean();
  if (existing) {
    console.log(`${email} already exists (role ${existing.role}); nothing changed.`);
  } else {
    await User.create({ email, password, firstName: 'Vitalis', lastName: 'Administrator', name: 'Vitalis Administrator', role: 'admin' });
    console.log(`Created administrator ${email}.`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Password (shown once, store it safely): ${password}`);
  }
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
