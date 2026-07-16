/**
 * Import snapshot demo từ file JSON (export từ local) lên MongoDB hiện tại.
 *
 * Usage:
 *   node scripts/importDemoSnapshots.js
 *   node scripts/importDemoSnapshots.js --reset
 *   node scripts/importDemoSnapshots.js --file=./scripts/data/trend-demo-snapshots.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');
const { DEMO_SNAPSHOT_TYPE, getDemoSnapshotFilter } = require('../utils/trendsDemoMode');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_user_management_db';
const DEFAULT_FILE = path.resolve(__dirname, 'data/trend-demo-snapshots.json');

function resolveFilePath() {
  const custom = process.argv.find((arg) => arg.startsWith('--file='));
  if (custom) {
    return path.resolve(custom.slice('--file='.length));
  }
  return DEFAULT_FILE;
}

function loadBundle(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file bundle: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(raw);

  if (!Array.isArray(payload.snapshots) || !payload.snapshots.length) {
    throw new Error('File bundle không có snapshot hợp lệ');
  }

  return payload;
}

async function main() {
  const filePath = resolveFilePath();
  const reset = process.argv.includes('--reset');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[import] MongoDB connected');

    const bundle = loadBundle(filePath);
    const periodKeys = bundle.snapshots.map((item) => item.periodKey);

    if (reset) {
      const removed = await ReportMonthSnapshot.deleteMany({
        periodKey: { $in: periodKeys },
        snapshotType: DEMO_SNAPSHOT_TYPE,
      });
      console.log(`[import] Removed ${removed.deletedCount} existing demo snapshot(s) in bundle range`);
    }

    let created = 0;
    let updated = 0;

    for (const item of bundle.snapshots) {
      const payload = {
        year: item.year,
        month: item.month,
        periodKey: item.periodKey,
        snapshotAt: item.snapshotAt ? new Date(item.snapshotAt) : new Date(),
        snapshotType: DEMO_SNAPSHOT_TYPE,
        summary: item.summary,
        criteria: item.criteria,
      };

      const existing = await ReportMonthSnapshot.findOne({
        periodKey: payload.periodKey,
        snapshotType: DEMO_SNAPSHOT_TYPE,
      });

      if (existing) {
        await ReportMonthSnapshot.updateOne({ _id: existing._id }, payload);
        updated += 1;
      } else {
        await ReportMonthSnapshot.create(payload);
        created += 1;
      }

      console.log(
        `[import] ${payload.periodKey} | overall=${Number(payload.summary?.overallScore || 0).toFixed(2)} | criteria=${payload.criteria?.length || 0}`,
      );
    }

    const totalDemo = await ReportMonthSnapshot.countDocuments(getDemoSnapshotFilter());
    console.log(`[import] Done. Created=${created}, Updated=${updated}, Total demo=${totalDemo}`);
    console.log(`[import] Bundle: ${filePath}`);
    console.log('[import] Mở tab "Xu hướng demo" trên FE để xem dữ liệu.');
  } catch (error) {
    console.error('[import] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
