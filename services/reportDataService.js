const mongoose = require('mongoose');
const Criteria = require('../models/Criteria');
const { getCriteriaDepartmentFilter, buildDepartmentIdFilter } = require('../utils/departmentAccess');
const {
  isExcludedFromEvaluation,
  buildCriteriaDetail,
  buildSummary,
  buildBelowLevel3,
  buildNotAchievedCriteria,
} = require('../utils/reportMetrics');

async function loadReportData(req) {
  const {
    part,
    chapter,
    keyword,
    assignedUser: assignedUserFilter,
    departmentId,
    notAchieved,
  } = req.body || {};

  const andConditions = [];

  const deptFilter = await getCriteriaDepartmentFilter(req.user.userId, req.user.role);
  if (deptFilter) andConditions.push(deptFilter);

  const departmentFilter = buildDepartmentIdFilter(departmentId);
  if (departmentFilter) andConditions.push(departmentFilter);

  if (part) andConditions.push({ part });
  if (chapter) andConditions.push({ chapter });
  if (keyword) {
    andConditions.push({
      $or: [
        { code: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
      ],
    });
  }

  const canSeeAll = !deptFilter;
  if (canSeeAll && assignedUserFilter && mongoose.Types.ObjectId.isValid(assignedUserFilter)) {
    andConditions.push({ assignedUser: assignedUserFilter });
  }

  if (notAchieved) {
    andConditions.push({
      $expr: {
        $lt: [
          {
            $cond: {
              if: { $lte: [{ $ifNull: ['$currentLevel', 0] }, 0] },
              then: 1,
              else: '$currentLevel',
            },
          },
          {
            $cond: {
              if: { $lte: [{ $ifNull: ['$expectedLevel', 0] }, 0] },
              then: 1,
              else: '$expectedLevel',
            },
          },
        ],
      },
    });
  }

  andConditions.push({ status: { $ne: false } });

  const filter = andConditions.length > 0 ? { $and: andConditions } : {};

  const criterias = await Criteria.find(filter)
    .sort({ code: 1 })
    .populate('assignedUser', 'username email')
    .populate('departmentId', 'name');

  const appliedCriteria = criterias.filter((c) => !isExcludedFromEvaluation(c.code));
  const criteriaReport = appliedCriteria.map(buildCriteriaDetail);
  const summary = buildSummary(appliedCriteria);

  return {
    summary,
    belowLevel3: buildBelowLevel3(appliedCriteria),
    notAchievedCriteria: buildNotAchievedCriteria(appliedCriteria),
    matrix: criteriaReport,
    details: criteriaReport,
    totalCriteria: summary.totalApplied,
    totalWeightedScore: summary.totalWeightedScore,
    totalWeight: summary.totalWeight,
    overallScore: summary.overallScore,
    weightedAverageByChapter: summary.weightedAverageByChapter,
    overallAverage: summary.overallScore,
  };
}

module.exports = { loadReportData };
