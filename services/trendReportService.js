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

const PERIOD_MONTH_MAP = {
  '1m': 1,
  '1q': 3,
  '6m': 6,
  '1y': 12,
};

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
  const { period = '1y', part, departmentId } = req.body || {};
  const monthCount = PERIOD_MONTH_MAP[period] || PERIOD_MONTH_MAP['1y'];

  const allSnapshots = await ReportMonthSnapshot.find({}).sort({ year: 1, month: 1 }).lean();
  const snapshots = allSnapshots.slice(-monthCount);

  if (!snapshots.length) {
    return {
      period,
      monthCount,
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
    const label = formatPeriodLabel(snapshot.year, snapshot.month);

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
    monthCount,
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
  PERIOD_MONTH_MAP,
  loadTrendReport,
  captureMonthSnapshot,
  listAvailablePeriods,
};
