/**
 * Cập nhật index MongoDB để snapshot demo và production cùng tồn tại.
 * Chạy một lần trên mỗi môi trường trước khi seed demo lần đầu.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_user_management_db';

const LEGACY_INDEXES = ['periodKey_1', 'year_1_month_1'];

async function dropLegacyIndexes(collection) {
  const indexes = await collection.indexes();

  for (const index of indexes) {
    const name = index.name;
    if (name === '_id_') continue;
    if (LEGACY_INDEXES.includes(name)) {
      await collection.dropIndex(name);
      console.log(`[migrate] Dropped legacy index: ${name}`);
    }
  }
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[migrate] MongoDB connected');

    const collection = ReportMonthSnapshot.collection;
    await dropLegacyIndexes(collection);
    await ReportMonthSnapshot.syncIndexes();
    console.log('[migrate] Snapshot indexes synced.');

    const indexes = await collection.indexes();
    indexes.forEach((item) => {
      console.log(`[migrate] index: ${item.name}`, JSON.stringify(item.key));
    });
  } catch (error) {
    console.error('[migrate] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
