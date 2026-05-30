#!/usr/bin/env node
/**
 * Greenfield seed (admin, necall.guest, set_config default).
 * Usage: MONGODB_URI=mongodb://host/lnsms node scripts/seed-greenfield.js
 */
require('dotenv').config();
const path = require('path');
const mongoose = require(path.join(__dirname, '../packages/lnsms-be/node_modules/mongoose'));

async function main() {
  const mongoUri = (process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`Connected: ${mongoUri.replace(/\/\/[^@]+@/, '//***@')}`);

  const { seedGreenfield } = require('../packages/lnsms-be/src/bootstrap/seed');
  await seedGreenfield();

  await mongoose.disconnect();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
