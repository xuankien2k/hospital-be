/**
 * Seed snapshot demo cho tab Xu hướng (tách biệt dữ liệu production).
 *
 * Production:
 *   1. Deploy BE mới
 *   2. node scripts/migrateSnapshotDemoIndexes.js
 *   3. TRENDS_DEMO_MODE=true node scripts/seedTrendSnapshots.js --demo --reset
 *   4. Bật TRENDS_DEMO_MODE=true trên server + restart PM2
 *
 * Tắt demo (quay lại snapshot thật):
 *   - Đặt TRENDS_DEMO_MODE=false (hoặc xóa biến) + restart BE
 *   - (Tuỳ chọn) node scripts/seedTrendSnapshots.js --clear-demo
 *
 * Local demo:
 *   npm run seed:trend-snapshots -- --demo --reset
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Criteria = require('../models/Criteria');
const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');
const { scoreCriteria } = require('../utils/reportMetrics');
const {
  buildSummaryFromSnapshotCriteria,
  captureMonthSnapshot,
} = require('../services/snapshotService');
const {
  DEMO_SNAPSHOT_TYPE,
  getDemoSnapshotFilter,
  getProductionSnapshotFilter,
} = require('../utils/trendsDemoMode');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_user_management_db';
const MONTH_COUNT = 24;
const END_YEAR = 2026;
const END_MONTH = 7;
const BASE_PERIOD_KEY = '2026-07';
const DEFAULT_CSV = path.resolve(__dirname, 'data/trend-demo-baseline.csv');

const toCriteriaLike = (item) => ({
  _id: item.criteriaId,
  code: item.code,
  name: item.name,
  part: item.part,
  chapter: item.chapter,
  currentLevel: item.currentLevel,
  expectedLevel: item.expectedLevel,
  progress: item.progress,
  departmentId: item.departmentId
    ? { _id: item.departmentId, name: item.departmentName }
    : null,
  levels: [],
  status: true,
});

const clampLevel = (level) => Math.min(5, Math.max(0, Math.round(level)));

const hashCode = (code) =>
  String(code || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

const addMonths = (year, month, delta) => {
  const date = new Date(year, month - 1 + delta, 15);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
};

const buildPeriodKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const objectIdFromCode = (code) => {
  const hash = crypto.createHash('md5').update(String(code)).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hash);
};

const parsePartFromCode = (code) => {
  const match = String(code || '').match(/^([A-E])/i);
  return match ? match[1].toUpperCase() : '';
};

const parseChapterFromCode = (code) => {
  const match = String(code || '').match(/^([A-E]\d+)/i);
  return match ? match[1].toUpperCase() : '';
};

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
};

const parseSnapshotCsv = (csvPath) => {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.includes('=== CHI TIẾT TỪNG TIÊU CHÍ ==='));
  if (markerIndex < 0) {
    throw new Error('Không tìm thấy phần chi tiết tiêu chí trong file CSV.');
  }

  const header = parseCsvLine(lines[markerIndex + 1]);
  const levelColumnIndex = header.length - 1;
  const criteria = [];

  for (let i = markerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 5) continue;

    const code = cols[0].trim();
    const name = cols[1].trim();
    const departmentName = cols[3].trim() || 'Chưa gán';
    const currentLevel = clampLevel(Number(cols[levelColumnIndex]));

    criteria.push({
      code,
      name,
      part: parsePartFromCode(code),
      chapter: parseChapterFromCode(code),
      departmentName,
      currentLevel,
      expectedLevel: 4,
      progress: Math.min(100, Math.round((currentLevel / 4) * 100)),
    });
  }

  if (!criteria.length) {
    throw new Error('File CSV không có dòng tiêu chí hợp lệ.');
  }

  return criteria;
};

const resolveCsvPath = () => {
  const arg = process.argv.find((item) => item.startsWith('--csv='));
  if (arg) {
    return path.resolve(arg.replace('--csv=', ''));
  }
  if (process.env.SNAPSHOT_BASELINE_CSV) {
    return path.resolve(process.env.SNAPSHOT_BASELINE_CSV);
  }
  return DEFAULT_CSV;
};

const attachCriteriaMetadata = async (baselineCriteria) => {
  const [departments, existingCriteria] = await Promise.all([
    Department.find().lean(),
    Criteria.find().select('_id code departmentId expectedLevel progress').populate('departmentId', 'name').lean(),
  ]);

  const deptByName = new Map(departments.map((item) => [item.name, item._id]));
  const criteriaByCode = new Map(existingCriteria.map((item) => [item.code, item]));

  return baselineCriteria.map((item) => {
    const existing = criteriaByCode.get(item.code);
    const departmentId = deptByName.get(item.departmentName) || existing?.departmentId?._id || null;

    return {
      criteriaId: existing?._id || objectIdFromCode(item.code),
      code: item.code,
      name: item.name,
      part: item.part,
      chapter: item.chapter,
      currentLevel: item.currentLevel,
      expectedLevel: existing?.expectedLevel ?? item.expectedLevel ?? 4,
      progress: existing?.progress ?? item.progress ?? 0,
      departmentId,
      departmentName: item.departmentName,
    };
  });
};

const generateLevelForMonth = (baseLevel, monthIndex, code) => {
  if (monthIndex === MONTH_COUNT - 1) {
    return clampLevel(baseLevel);
  }

  const seed = hashCode(code);
  const startGap = 1.2 + (seed % 5) * 0.35 + ((seed % 17) / 17) * 0.8;
  const startLevel = Math.max(1, baseLevel - startGap);
  const t = monthIndex / (MONTH_COUNT - 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const wave = Math.sin(monthIndex * 0.75 + seed * 0.11) * 0.75;
  const drift = Math.cos(monthIndex * 0.45 + seed * 0.07) * 0.35;
  const setback =
    monthIndex > 4 && monthIndex < MONTH_COUNT - 2 && (seed + monthIndex) % 13 === 0 ? -1.1 : 0;
  const raw = startLevel + (baseLevel - startLevel) * eased + wave + drift + setback;

  return clampLevel(Math.min(baseLevel, raw));
};

const buildCriteriaForMonth = (baselineCriteria, monthIndex) =>
  baselineCriteria.map((item) => {
    const currentLevel = generateLevelForMonth(item.currentLevel, monthIndex, item.code);
    const criteriaLike = toCriteriaLike({ ...item, currentLevel });
    const { weightedScore } = scoreCriteria(criteriaLike);

    return {
      criteriaId: item.criteriaId,
      code: item.code,
      name: item.name,
      part: item.part,
      chapter: item.chapter,
      currentLevel,
      expectedLevel: item.expectedLevel,
      progress: item.progress,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      weightedScore,
    };
  });

async function getBaselineCriteriaFromDb() {
  let baseline = await ReportMonthSnapshot.findOne({
    periodKey: BASE_PERIOD_KEY,
    ...getProductionSnapshotFilter(),
  }).lean();

  if (!baseline) {
    baseline = await ReportMonthSnapshot.findOne(getProductionSnapshotFilter())
      .sort({ year: -1, month: -1 })
      .lean();
  }

  if (!baseline) {
    const { snapshot } = await captureMonthSnapshot({ force: true, snapshotType: 'manual' });
    baseline = snapshot.toObject();
  }

  return baseline.criteria || [];
}

async function getBaselineCriteria() {
  const csvPath = resolveCsvPath();
  if (fs.existsSync(csvPath)) {
    console.log(`[seed] Baseline from CSV: ${csvPath}`);
    const parsed = parseSnapshotCsv(csvPath);
    return attachCriteriaMetadata(parsed);
  }

  console.log('[seed] CSV not found, fallback to production snapshot baseline');
  return getBaselineCriteriaFromDb();
}

async function clearDemoSnapshots() {
  const result = await ReportMonthSnapshot.deleteMany(getDemoSnapshotFilter());
  console.log(`[seed] Removed ${result.deletedCount} demo snapshot(s).`);
}

async function seedTrendSnapshots({ reset = false, demo = true } = {}) {
  if (!demo) {
    throw new Error('Chỉ hỗ trợ seed snapshot demo. Thêm cờ --demo.');
  }

  const baselineCriteria = await getBaselineCriteria();
  if (!baselineCriteria.length) {
    throw new Error('Không có dữ liệu nền để sinh snapshot demo.');
  }

  console.log(`[seed] Baseline criteria count: ${baselineCriteria.length}`);
  console.log(`[seed] Snapshot type: ${DEMO_SNAPSHOT_TYPE}`);

  const periodKeys = [];
  for (let monthIndex = 0; monthIndex < MONTH_COUNT; monthIndex += 1) {
    const offset = monthIndex - (MONTH_COUNT - 1);
    const { year, month } = addMonths(END_YEAR, END_MONTH, offset);
    periodKeys.push(buildPeriodKey(year, month));
  }

  if (reset) {
    await ReportMonthSnapshot.deleteMany({
      periodKey: { $in: periodKeys },
      snapshotType: DEMO_SNAPSHOT_TYPE,
    });
    console.log(`[seed] Removed demo snapshots in range: ${periodKeys[0]} .. ${periodKeys.at(-1)}`);
  }

  let created = 0;
  let updated = 0;

  for (let monthIndex = 0; monthIndex < MONTH_COUNT; monthIndex += 1) {
    const offset = monthIndex - (MONTH_COUNT - 1);
    const { year, month } = addMonths(END_YEAR, END_MONTH, offset);
    const periodKey = buildPeriodKey(year, month);
    const criteria = buildCriteriaForMonth(baselineCriteria, monthIndex);
    const summary = buildSummaryFromSnapshotCriteria(criteria);
    const snapshotAt = new Date(year, month - 1, 28, 8, 0, 0);

    const payload = {
      year,
      month,
      periodKey,
      snapshotAt,
      snapshotType: DEMO_SNAPSHOT_TYPE,
      summary,
      criteria,
    };

    const existing = await ReportMonthSnapshot.findOne({
      periodKey,
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
      `[seed] ${periodKey} | overall=${summary.overallScore.toFixed(2)} | applied=${summary.totalApplied}`,
    );
  }

  console.log(`[seed] Done. Created=${created}, Updated=${updated}, Total months=${MONTH_COUNT}`);
  console.log(`[seed] Range: ${periodKeys[0]} -> ${periodKeys.at(-1)}`);
  console.log('[seed] Bật TRENDS_DEMO_MODE=true trên BE để hiển thị dữ liệu demo.');
}

async function main() {
  const reset = process.argv.includes('--reset');
  const demo = process.argv.includes('--demo');
  const clearDemo = process.argv.includes('--clear-demo');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[seed] MongoDB connected');

    if (clearDemo) {
      await clearDemoSnapshots();
      return;
    }

    if (!demo) {
      throw new Error('Thiếu cờ --demo. Ví dụ: node scripts/seedTrendSnapshots.js --demo --reset');
    }

    await seedTrendSnapshots({ reset, demo: true });
  } catch (error) {
    console.error('[seed] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
