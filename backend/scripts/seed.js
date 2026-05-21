/**
 * Seed script — run once to create the default admin account in MongoDB.
 * Usage:  node scripts/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User     = require('../models/User');

const SEED_ADMIN = {
  clientId:  'admin-seed-001',
  role:      'admin',
  fullName:  'Baraka Mahuvi',
  email:     'barakamahuvi99@gmail.com',
  password:  'Shazam@255',
  seeded:    true,
  status:    'active',
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ email: SEED_ADMIN.email });
    if (existing) {
      console.log('ℹ️  Seed admin already exists — skipping');
    } else {
      const passwordHash = await User.hashPassword(SEED_ADMIN.password);
      await User.create({
        clientId:     SEED_ADMIN.clientId,
        role:         SEED_ADMIN.role,
        fullName:     SEED_ADMIN.fullName,
        email:        SEED_ADMIN.email,
        passwordHash,
        seeded:       SEED_ADMIN.seeded,
        status:       SEED_ADMIN.status,
      });
      console.log(`✅ Seed admin created: ${SEED_ADMIN.email}`);
    }
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
}

seed();
