/**
 * Chạy một lần rồi thoát — dùng cho Railway Cron (snapshot tháng hiện tại).
 * Env: MONGODB_URI (bắt buộc trên cloud).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { captureMonthSnapshot } = require('../services/snapshotService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_user_management_db';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const result = await captureMonthSnapshot();
  const key = result.snapshot?.periodKey || 'unknown';
  console.log(
    `[cron] monthly snapshot ${result.created ? 'created' : 'skipped (exists)'} period=${key}`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('[cron] monthly snapshot failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
