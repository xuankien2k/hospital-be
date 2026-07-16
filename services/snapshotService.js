const Criteria = require('../models/Criteria');
const ReportMonthSnapshot = require('../models/ReportMonthSnapshot');
const {
  getProductionSnapshotFilter,
  PRODUCTION_SNAPSHOT_TYPES,
  resolveSnapshotScopeFilter,
} = require('../utils/trendsDemoMode');
const {
  isExcludedFromEvaluation,
  buildSummary,
  getCriteriaLevel,
  scoreCriteria,
  getDepartmentId,
  getDepartmentName,
} = require('../utils/reportMetrics');

function buildPeriodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getCurrentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    periodKey: buildPeriodKey(now.getFullYear(), now.getMonth() + 1),
  };
}

function toCriteriaLike(item) {
  return {
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
  };
}

async function loadAppliedCriteria() {
  const criterias = await Criteria.find({ status: { $ne: false } })
    .sort({ code: 1 })
    .populate('departmentId', 'name')
    .populate('assignedUser', 'username email');

  return criterias.filter((item) => !isExcludedFromEvaluation(item.code));
}

async function captureMonthSnapshot({ force = false, snapshotType = 'monthly_auto' } = {}) {
  const { year, month, periodKey } = getCurrentPeriod();
  const existing = await ReportMonthSnapshot.findOne({
    periodKey,
    snapshotType: { $in: PRODUCTION_SNAPSHOT_TYPES },
  });

  if (existing && !force) {
    return { created: false, snapshot: existing };
  }

  const appliedCriteria = await loadAppliedCriteria();
  const summary = buildSummary(appliedCriteria);
  const criteria = appliedCriteria.map((item) => {
    const level = getCriteriaLevel(item);
    const { weightedScore } = scoreCriteria(item);

    return {
      criteriaId: item._id,
      code: item.code,
      name: item.name,
      part: item.part,
      chapter: item.chapter,
      currentLevel: level,
      expectedLevel: item.expectedLevel,
      progress: item.progress,
      departmentId: getDepartmentId(item),
      departmentName: getDepartmentName(item),
      weightedScore,
    };
  });

  const payload = {
    year,
    month,
    periodKey,
    snapshotAt: new Date(),
    snapshotType,
    summary,
    criteria,
  };

  const snapshot = existing
    ? await ReportMonthSnapshot.findOneAndUpdate(
        { periodKey, snapshotType: existing.snapshotType },
        payload,
        { new: true },
      )
    : await ReportMonthSnapshot.create(payload);

  return { created: !existing, snapshot };
}

async function listAvailablePeriods({ demo } = {}) {
  const snapshots = await ReportMonthSnapshot.find(resolveSnapshotScopeFilter(demo))
    .sort({ year: -1, month: -1 })
    .select('year month periodKey snapshotAt snapshotType summary.overallScore summary.totalApplied');

  return snapshots.map((item) => ({
    year: item.year,
    month: item.month,
    periodKey: item.periodKey,
    snapshotAt: item.snapshotAt,
    snapshotType: item.snapshotType,
    overallScore: item.summary?.overallScore ?? 0,
    totalApplied: item.summary?.totalApplied ?? 0,
  }));
}

function buildSummaryFromSnapshotCriteria(criteriaList) {
  return buildSummary(criteriaList.map(toCriteriaLike));
}

module.exports = {
  buildPeriodKey,
  getCurrentPeriod,
  toCriteriaLike,
  captureMonthSnapshot,
  listAvailablePeriods,
  buildSummaryFromSnapshotCriteria,
};
