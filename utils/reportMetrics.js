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

const Criteria = require('../models/Criteria');

function getEffectiveCurrentLevel(criteria) {
  if (criteria.levels && criteria.levels.length > 0) {
    return Criteria.calculateCurrentLevel(criteria.levels);
  }
  return normalizeLevel(criteria.currentLevel);
}

function getEffectiveExpectedLevel(criteria) {
  return normalizeLevel(criteria.expectedLevel);
}

function isCriteriaNotAchieved(criteria) {
  return getEffectiveCurrentLevel(criteria) < getEffectiveExpectedLevel(criteria);
}

function buildNotAchievedCriteria(criteriaList) {
  return criteriaList
    .filter(isCriteriaNotAchieved)
    .map((c) => ({
      _id: c._id,
      code: c.code,
      name: c.name,
      currentLevel: getEffectiveCurrentLevel(c),
      expectedLevel: getEffectiveExpectedLevel(c),
      departmentName: getDepartmentName(c),
      part: c.part,
      chapter: c.chapter,
      expectedLevelCompletionDate: c.expectedLevelCompletionDate,
    }));
}

function sortCriteriaForMatrix(a, b) {
  const partCmp = String(a.part || '').localeCompare(String(b.part || ''), 'vi');
  if (partCmp !== 0) return partCmp;
  const chapterCmp = String(a.chapter || '').localeCompare(String(b.chapter || ''), 'vi');
  if (chapterCmp !== 0) return chapterCmp;
  return String(a.code || '').localeCompare(String(b.code || ''), 'vi');
}

function buildMatrixGrouped(criteriaDetails) {
  const sorted = [...criteriaDetails].sort(sortCriteriaForMatrix);
  const partCounts = {};
  sorted.forEach((c) => {
    const p = String(c.part || '').trim().toUpperCase();
    partCounts[p] = (partCounts[p] || 0) + 1;
  });

  const rows = [];
  let lastPart = null;
  let lastChapter = null;

  sorted.forEach((c) => {
    const part = String(c.part || '').trim().toUpperCase();
    const chapter = String(c.chapter || '').trim();

    if (part && part !== lastPart) {
      const partLabel = PART_LABELS[part] || part;
      rows.push({
        rowType: 'part',
        code: '',
        name: `PHẦN ${part}. ${partLabel.toUpperCase()} (${partCounts[part] || 0})`,
        currentLevel: '',
        expectedLevel: '',
        departmentName: '',
      });
      lastPart = part;
      lastChapter = null;
    }

    if (chapter && chapter !== lastChapter) {
      const chapterItems = sorted.filter(
        (item) => String(item.part || '').trim().toUpperCase() === part && String(item.chapter || '').trim() === chapter,
      );
      rows.push({
        rowType: 'chapter',
        code: chapter,
        name: `${chapter}. (${chapterItems.length} tiêu chí)`,
        currentLevel: '',
        expectedLevel: '',
        departmentName: '',
      });
      lastChapter = chapter;
    }

    const current = getEffectiveCurrentLevel(c);
    const expected = getEffectiveExpectedLevel(c);
    rows.push({
      rowType: 'criteria',
      code: c.code,
      name: c.name,
      currentLevel: String(current),
      expectedLevel: String(expected),
      departmentName: c.departmentName || 'Chưa gán',
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
  buildNotAchievedCriteria,
  buildMatrixGrouped,
};
