/**
 * Export snapshot demo từ MongoDB local ra file JSON để import lên production.
 *
 * Usage:
 *   node scripts/exportDemoSnapshots.js
 *   node scripts/exportDemoSnapshots.js --out=./scripts/data/trend-demo-snapshots.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');
const { getDemoSnapshotFilter } = require('../utils/trendsDemoMode');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_user_management_db';
const DEFAULT_OUT = path.resolve(__dirname, 'data/trend-demo-snapshots.json');

function resolveOutPath() {
  const custom = process.argv.find((arg) => arg.startsWith('--out='));
  if (custom) {
    return path.resolve(custom.slice('--out='.length));
  }
  return DEFAULT_OUT;
}

function serializeSnapshot(doc) {
  const item = doc.toObject ? doc.toObject() : doc;
  return {
    year: item.year,
    month: item.month,
    periodKey: item.periodKey,
    snapshotAt: item.snapshotAt,
    snapshotType: item.snapshotType,
    summary: item.summary,
    criteria: item.criteria,
  };
}

async function main() {
  const outPath = resolveOutPath();

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[export] MongoDB connected');

    const snapshots = await ReportMonthSnapshot.find(getDemoSnapshotFilter())
      .sort({ year: 1, month: 1 })
      .lean();

    if (!snapshots.length) {
      throw new Error('Không tìm thấy snapshot demo. Chạy seed trước: node scripts/seedTrendSnapshots.js --demo --reset');
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshotType: 'demo',
      count: snapshots.length,
      snapshots: snapshots.map(serializeSnapshot),
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log(`[export] Exported ${snapshots.length} demo snapshot(s)`);
    console.log(`[export] Range: ${snapshots[0].periodKey} -> ${snapshots.at(-1).periodKey}`);
    console.log(`[export] File: ${outPath}`);
  } catch (error) {
    console.error('[export] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
