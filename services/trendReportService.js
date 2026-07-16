const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');
const { PART_LABELS } = require('../constants/report');
const {
  getUserDepartmentId,
  userCanViewAllCriteria,
} = require('../utils/departmentAccess');
const { normalizePartKey } = require('../utils/reportMetrics');
const {
  buildSummaryFromSnapshotCriteria,
  captureMonthSnapshot,
  listAvailablePeriods,
} = require('./snapshotService');
const { resolveDemoModeFlag, resolveSnapshotScopeFilter } = require('../utils/trendsDemoMode');

const PERIOD_GRANULARITY = {
  '1m': 'month',
  '1q': 'quarter',
  '6m': 'halfyear',
  '1y': 'year',
};

const PERIOD_MONTH_MAP = {
  '1m': 1,
  '1q': 3,
  '6m': 6,
  '1y': 12,
};

function getBucketKey(year, month, granularity) {
  if (granularity === 'month') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  if (granularity === 'quarter') {
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }

  if (granularity === 'halfyear') {
    const half = month <= 6 ? 1 : 2;
    return `${year}-H${half}`;
  }

  return `${year}`;
}

function formatBucketLabel(bucketKey, granularity) {
  if (granularity === 'month') {
    const match = bucketKey.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      return `T${Number(match[2])}/${match[1]}`;
    }
  }

  if (granularity === 'quarter') {
    const match = bucketKey.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      return `Q${match[2]}/${match[1]}`;
    }
  }

  if (granularity === 'halfyear') {
    const match = bucketKey.match(/^(\d{4})-H([12])$/);
    if (match) {
      return match[2] === '1' ? `6T1/${match[1]}` : `6T2/${match[1]}`;
    }
  }

  if (granularity === 'year') {
    return `Năm ${bucketKey}`;
  }

  return bucketKey;
}

function groupSnapshotsByGranularity(snapshots, period) {
  const granularity = PERIOD_GRANULARITY[period] || PERIOD_GRANULARITY['1m'];
  const buckets = new Map();

  snapshots.forEach((snapshot) => {
    const bucketKey = getBucketKey(snapshot.year, snapshot.month, granularity);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push(snapshot);
  });

  return Array.from(buckets.entries())
    .map(([bucketKey, group]) => {
      const sorted = group.sort((a, b) => a.year - b.year || a.month - b.month);
      const lastSnapshot = sorted[sorted.length - 1];

      return {
        ...lastSnapshot,
        bucketKey,
        periodKey: bucketKey,
        label: formatBucketLabel(bucketKey, granularity),
        sourceMonthCount: sorted.length,
      };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

async function filterSnapshotCriteriaForUser(userId, role, criteria = []) {
  if (await userCanViewAllCriteria(userId, role)) {
    return criteria;
  }

  const userDeptId = await getUserDepartmentId(userId);
  if (userDeptId) {
    return criteria.filter((item) => {
      if (!item.departmentId) return true;
      return String(item.departmentId) === String(userDeptId);
    });
  }

  return criteria.filter((item) => !item.departmentId);
}

function formatPeriodLabel(year, month) {
  return `T${month}/${year}`;
}

function analyzeCriteriaChanges(snapshots) {
  if (snapshots.length < 2) {
    return { improved: [], declined: [], stagnant: [] };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const lastMap = new Map(last.criteria.map((item) => [item.code, item]));
  const improved = [];
  const declined = [];
  const stagnant = [];

  first.criteria.forEach((startItem) => {
    const endItem = lastMap.get(startItem.code);
    if (!endItem) return;

    const startLevel = Number(startItem.currentLevel) || 0;
    const endLevel = Number(endItem.currentLevel) || 0;

    if (endLevel > startLevel) {
      improved.push({
        code: startItem.code,
        name: startItem.name,
        from: startLevel,
        to: endLevel,
        departmentName: endItem.departmentName,
      });
      return;
    }

    if (endLevel < startLevel) {
      declined.push({
        code: startItem.code,
        name: startItem.name,
        from: startLevel,
        to: endLevel,
        departmentName: endItem.departmentName,
      });
      return;
    }

    const unchanged = snapshots.every((snapshot) => {
      const current = snapshot.criteria.find((item) => item.code === startItem.code);
      return current && Number(current.currentLevel) === startLevel;
    });

    if (unchanged) {
      stagnant.push({
        code: startItem.code,
        name: startItem.name,
        level: startLevel,
        monthsUnchanged: snapshots.length,
        departmentName: endItem.departmentName,
      });
    }
  });

  return {
    improved: improved.sort((a, b) => b.to - b.from - (a.to - a.from)),
    declined: declined.sort((a, b) => a.to - a.from - (b.to - b.from)),
    stagnant: stagnant.sort((a, b) => b.monthsUnchanged - a.monthsUnchanged),
  };
}

function buildCriteriaTrend(scopedSnapshots) {
  const criteriaMap = new Map();

  scopedSnapshots.forEach((snapshot) => {
    (snapshot.criteria || []).forEach((item) => {
      const partKey = normalizePartKey({
        part: item.part,
        chapter: item.chapter,
        code: item.code,
      });

      if (!criteriaMap.has(item.code)) {
        criteriaMap.set(item.code, {
          code: item.code,
          name: item.name,
          part: partKey,
          partLabel: PART_LABELS[partKey] || String(item.part || '').trim() || partKey || 'Khác',
          departmentId: item.departmentId || null,
          departmentName: item.departmentName || 'Chưa gán',
          points: [],
        });
      }

      criteriaMap.get(item.code).points.push({
        periodKey: snapshot.periodKey,
        label: snapshot.label,
        currentLevel: Number(item.currentLevel) || 0,
      });
    });
  });

  return Array.from(criteriaMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code, 'vi', { numeric: true }),
  );
}

async function loadTrendReport(req) {
  const { period = '1m', part, departmentId, demo } = req.body || {};
  const granularity = PERIOD_GRANULARITY[period] || PERIOD_GRANULARITY['1m'];

  const allSnapshots = await ReportMonthSnapshot.find(resolveSnapshotScopeFilter(demo))
    .sort({ year: 1, month: 1 })
    .lean();
  const snapshots = groupSnapshotsByGranularity(allSnapshots, period);

  if (!snapshots.length) {
    return {
      period,
      granularity,
      demoMode: resolveDemoModeFlag(demo),
      monthCount: PERIOD_MONTH_MAP[period] || PERIOD_MONTH_MAP['1m'],
      periods: [],
      overallTrend: [],
      byPartTrend: {},
      byDepartmentTrend: [],
      byCriteriaTrend: [],
      criteriaAnalysis: { improved: [], declined: [], stagnant: [] },
      hasEnoughData: false,
      snapshotCount: 0,
    };
  }

  const scopedSnapshots = [];
  const overallTrend = [];
  const byPartTrendMap = {};
  const byDepartmentTrendMap = {};

  for (const snapshot of snapshots) {
    let criteria = await filterSnapshotCriteriaForUser(
      req.user.userId,
      req.user.role,
      snapshot.criteria || [],
    );

    if (part) {
      criteria = criteria.filter((item) => {
        const partKey = normalizePartKey({
          part: item.part,
          chapter: item.chapter,
          code: item.code,
        });
        return partKey === String(part).trim().toUpperCase();
      });
    }

    if (departmentId) {
      criteria = criteria.filter((item) => String(item.departmentId) === String(departmentId));
    }

    const summary = buildSummaryFromSnapshotCriteria(criteria);
    const label = snapshot.label || formatPeriodLabel(snapshot.year, snapshot.month);

    overallTrend.push({
      periodKey: snapshot.periodKey,
      label,
      year: snapshot.year,
      month: snapshot.month,
      overallScore: Number(summary.overallScore.toFixed(2)),
      totalApplied: summary.totalApplied,
      appliedPercent: Number(summary.appliedPercent.toFixed(1)),
    });

    (summary.byPart || []).forEach((row) => {
      if (!byPartTrendMap[row.part]) {
        byPartTrendMap[row.part] = [];
      }
      byPartTrendMap[row.part].push({
        periodKey: snapshot.periodKey,
        label,
        avgScore: Number(row.avgScore.toFixed(2)),
        count: row.count,
      });
    });

    (summary.byDepartment || []).forEach((row) => {
      const key = row.departmentId || row.name || 'unassigned';
      if (!byDepartmentTrendMap[key]) {
        byDepartmentTrendMap[key] = {
          departmentId: row.departmentId,
          name: row.name,
          points: [],
        };
      }
      byDepartmentTrendMap[key].points.push({
        periodKey: snapshot.periodKey,
        label,
        avgScore: Number(row.avgScore.toFixed(2)),
        count: row.count,
        rank: row.rank,
      });
    });

    scopedSnapshots.push({
      periodKey: snapshot.periodKey,
      label,
      criteria,
    });
  }

  return {
    period,
    granularity,
    demoMode: resolveDemoModeFlag(demo),
    monthCount: PERIOD_MONTH_MAP[period] || PERIOD_MONTH_MAP['1m'],
    periods: overallTrend.map((item) => item.periodKey),
    overallTrend,
    byPartTrend: byPartTrendMap,
    byDepartmentTrend: Object.values(byDepartmentTrendMap),
    byCriteriaTrend: buildCriteriaTrend(scopedSnapshots),
    criteriaAnalysis: analyzeCriteriaChanges(scopedSnapshots),
    hasEnoughData: overallTrend.length >= 2,
    snapshotCount: overallTrend.length,
  };
}

module.exports = {
  PERIOD_GRANULARITY,
  PERIOD_MONTH_MAP,
  groupSnapshotsByGranularity,
  loadTrendReport,
  captureMonthSnapshot,
  listAvailablePeriods,
};
