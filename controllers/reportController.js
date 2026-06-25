const mongoose = require('mongoose');
const Criteria = require('../models/Criteria');
const { getCriteriaDepartmentFilter, buildDepartmentIdFilter } = require('../utils/departmentAccess');
const {
  isExcludedFromEvaluation,
  buildCriteriaDetail,
  buildSummary,
  buildBelowLevel3,
  buildNotAchievedSubcriteria,
} = require('../utils/reportMetrics');

exports.getReport = async (req, res) => {
  try {
    const {
      part,
      chapter,
      keyword,
      assignedUser: assignedUserFilter,
      departmentId,
      notAchieved,
    } = req.body;
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

    return res.json({
      message: 'Báo cáo chất lượng bệnh viện thành công',
      report: {
        summary,
        belowLevel3: buildBelowLevel3(appliedCriteria),
        notAchievedSubcriteria: buildNotAchievedSubcriteria(appliedCriteria),
        matrix: criteriaReport,
        details: criteriaReport,
        // Giữ tương thích FE cũ
        totalCriteria: summary.totalApplied,
        totalWeightedScore: summary.totalWeightedScore,
        totalWeight: summary.totalWeight,
        overallScore: summary.overallScore,
        weightedAverageByChapter: summary.weightedAverageByChapter,
        overallAverage: summary.overallScore,
      },
    });
  } catch (error) {
    console.error('Lỗi báo cáo:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};
