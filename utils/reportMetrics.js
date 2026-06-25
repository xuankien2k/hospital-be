const {
  TOTAL_CRITERIA_STANDARD,
  EXCLUDED_CRITERIA_CODES,
  PART_LABELS,
  PART_ORDER,
} = require('../constants/report');

function getChapterCoefficient(chapter) {
  if (!chapter) return 1;
  const ch = String(chapter);
  if (ch === 'C3' || ch === 'C5') return 2;
  if (ch.startsWith('C3.') || ch.startsWith('C5.')) return 2;
  return 1;
}

function normalizeLevel(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round(num)));
}

function isExcludedFromEvaluation(code) {
  return EXCLUDED_CRITERIA_CODES.includes(String(code || '').trim());
}

function getDepartmentName(criteria) {
  if (criteria.departmentId && typeof criteria.departmentId === 'object' && criteria.departmentId.name) {
    return criteria.departmentId.name;
  }
  return 'Chưa gán';
}

function getDepartmentId(criteria) {
  if (!criteria.departmentId) return null;
  if (typeof criteria.departmentId === 'object' && criteria.departmentId._id) {
    return String(criteria.departmentId._id);
  }
  return String(criteria.departmentId);
}

function scoreCriteria(criteria) {
  const coefficient = getChapterCoefficient(criteria.chapter);
  const level = normalizeLevel(criteria.currentLevel);
  return {
    level,
    coefficient,
    weightedScore: level * coefficient,
  };
}

function buildCriteriaDetail(criteria) {
  const { level, coefficient, weightedScore } = scoreCriteria(criteria);
  return {
    _id: criteria._id,
    code: criteria.code,
    name: criteria.name,
    currentLevel: criteria.currentLevel,
    normalizedLevel: level,
    expectedLevel: criteria.expectedLevel,
    expectedLevelCompletionDate: criteria.expectedLevelCompletionDate,
    criteriaActualCompletionDate: criteria.criteriaActualCompletionDate,
    levels: (criteria.levels || []).map((l) => ({
      levelNumber: l.levelNumber,
      actualCompletionDate: l.actualCompletionDate,
      subCriterias: l.subCriterias,
    })),
    coefficient,
    weightedScore,
    part: criteria.part,
    chapter: criteria.chapter,
    assignedUser: criteria.assignedUser,
    departmentId: getDepartmentId(criteria),
    departmentName: getDepartmentName(criteria),
    updatedAt: criteria.updatedAt,
    status: criteria.status,
    progress: criteria.progress,
    excludedFromEvaluation: isExcludedFromEvaluation(criteria.code),
  };
}

function aggregateByLevel(criteriaList) {
  const counts = { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 };
  criteriaList.forEach((c) => {
    const lv = normalizeLevel(c.currentLevel);
    if (lv >= 1 && lv <= 5) counts[`level${lv}`] += 1;
  });
  return counts;
}

function aggregateByPart(criteriaList) {
  const map = {};
  criteriaList.forEach((c) => {
    const part = String(c.part || '').trim().toUpperCase();
    if (!part) return;
    if (!map[part]) {
      map[part] = { part, count: 0, totalWeightedScore: 0, totalWeight: 0 };
    }
    const { weightedScore, coefficient } = scoreCriteria(c);
    map[part].count += 1;
    map[part].totalWeightedScore += weightedScore;
    map[part].totalWeight += coefficient;
  });

  return PART_ORDER
    .filter((p) => map[p])
    .map((part) => {
      const row = map[part];
      return {
        part,
        label: PART_LABELS[part] || part,
        count: row.count,
        avgScore: row.count ? row.totalWeightedScore / row.count : 0,
        totalWeightedScore: row.totalWeightedScore,
        totalWeight: row.totalWeight,
      };
    });
}

function aggregateByDepartment(criteriaList) {
  const map = {};
  criteriaList.forEach((c) => {
    const deptId = getDepartmentId(c) || 'unassigned';
    const deptName = getDepartmentName(c);
    if (!map[deptId]) {
      map[deptId] = {
        departmentId: deptId === 'unassigned' ? null : deptId,
        name: deptName,
        count: 0,
        totalWeightedScore: 0,
        totalWeight: 0,
      };
    }
    const { weightedScore, coefficient } = scoreCriteria(c);
    map[deptId].count += 1;
    map[deptId].totalWeightedScore += weightedScore;
    map[deptId].totalWeight += coefficient;
  });

  const rows = Object.values(map)
    .map((row) => ({
      ...row,
      avgScore: row.count ? row.totalWeightedScore / row.count : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildBelowLevel3(criteriaList) {
  return criteriaList
    .filter((c) => normalizeLevel(c.currentLevel) < 3)
    .map((c) => ({
      _id: c._id,
      code: c.code,
      name: c.name,
      currentLevel: normalizeLevel(c.currentLevel),
      expectedLevel: c.expectedLevel,
      departmentName: getDepartmentName(c),
      part: c.part,
      chapter: c.chapter,
    }));
}

function buildNotAchievedSubcriteria(criteriaList) {
  const rows = [];
  criteriaList.forEach((c) => {
    const departmentName = getDepartmentName(c);
    const currentLevel = normalizeLevel(c.currentLevel);
    const expectedLevel = normalizeLevel(c.expectedLevel);

    (c.levels || []).forEach((level) => {
      (level.subCriterias || []).forEach((sub, subIndex) => {
        if (!sub.status) {
          rows.push({
            criteriaId: c._id,
            code: c.code,
            criteriaName: c.name,
            subcriteriaText: sub.text,
            levelNumber: level.levelNumber,
            subIndex,
            currentLevel,
            expectedLevel,
            departmentName,
            part: c.part,
            chapter: c.chapter,
          });
        }
      });
    });
  });
  return rows;
}

function buildSummary(criteriaList) {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  criteriaList.forEach((c) => {
    const { weightedScore, coefficient } = scoreCriteria(c);
    totalWeightedScore += weightedScore;
    totalWeight += coefficient;
  });

  const totalApplied = criteriaList.length;
  const overallScore = totalApplied ? totalWeightedScore / totalApplied : 0;

  return {
    totalStandard: TOTAL_CRITERIA_STANDARD,
    totalApplied,
    excludedCodes: EXCLUDED_CRITERIA_CODES,
    appliedPercent: TOTAL_CRITERIA_STANDARD
      ? (totalApplied / TOTAL_CRITERIA_STANDARD) * 100
      : 0,
    overallScore,
    totalWeightedScore,
    totalWeight,
    weightedAverageByChapter: totalWeight ? totalWeightedScore / totalWeight : 0,
    byLevel: aggregateByLevel(criteriaList),
    byPart: aggregateByPart(criteriaList),
    byDepartment: aggregateByDepartment(criteriaList),
  };
}

module.exports = {
  TOTAL_CRITERIA_STANDARD,
  EXCLUDED_CRITERIA_CODES,
  getChapterCoefficient,
  normalizeLevel,
  isExcludedFromEvaluation,
  buildCriteriaDetail,
  buildSummary,
  buildBelowLevel3,
  buildNotAchievedSubcriteria,
};
