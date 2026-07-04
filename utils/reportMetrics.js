const {
  TOTAL_CRITERIA_STANDARD,
  EXCLUDED_CRITERIA_CODES,
  PART_LABELS,
  PART_ORDER,
} = require('../constants/report');

const Criteria = require('../models/Criteria');

function getCriteriaLevel(criteria) {
  if (criteria.levels && criteria.levels.length > 0) {
    return Criteria.calculateCurrentLevel(criteria.levels);
  }
  return normalizeLevel(criteria.currentLevel);
}

function normalizePartKey(criteria) {
  const part = String(criteria.part || '').trim();
  const chapter = String(criteria.chapter || '').trim();
  const code = String(criteria.code || '').trim();

  if (/^[A-E]$/i.test(part)) return part.toUpperCase();

  const fromPart = part.match(/^([A-E])\s*[\.\):\-]/i);
  if (fromPart) return fromPart[1].toUpperCase();

  const fromChapter = chapter.match(/^([A-E])\d/i);
  if (fromChapter) return fromChapter[1].toUpperCase();

  const fromCode = code.match(/^([A-E])\d/i);
  if (fromCode) return fromCode[1].toUpperCase();

  const first = part.charAt(0).toUpperCase();
  if (/^[A-E]$/.test(first)) return first;

  return '';
}

function normalizeChapterKey(chapter, code) {
  const ch = String(chapter || '').trim();
  const c = String(code || '').trim();

  const fromChapter = ch.match(/^([A-E]\d+)/i);
  if (fromChapter) return fromChapter[1].toUpperCase();

  const fromCode = c.match(/^([A-E]\d+)/i);
  if (fromCode) return fromCode[1].toUpperCase();

  return ch;
}

function getChapterCoefficient(chapter, code) {
  const ch = normalizeChapterKey(chapter, code);
  if (!ch) return 1;
  if (ch === 'C3' || ch === 'C5') return 2;
  if (ch.startsWith('C3.') || ch.startsWith('C5.')) return 2;
  return 1;
}

function normalizeLevel(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(5, Math.max(0, Math.round(num)));
}

function normalizeExpectedLevel(value) {
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
  const coefficient = getChapterCoefficient(criteria.chapter, criteria.code);
  const level = getCriteriaLevel(criteria);
  return {
    level,
    coefficient,
    weightedScore: level * coefficient,
  };
}

function getPlainLevelScore(criteria) {
  return getCriteriaLevel(criteria);
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
  const counts = { level0: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 };
  criteriaList.forEach((c) => {
    const lv = getCriteriaLevel(c);
    if (lv >= 0 && lv <= 5) counts[`level${lv}`] += 1;
  });
  return counts;
}

function aggregateByPart(criteriaList) {
  const map = {};
  criteriaList.forEach((c) => {
    const part = normalizePartKey(c);
    if (!part) return;
    if (!map[part]) {
      map[part] = {
        part,
        count: 0,
        totalLevelScore: 0,
        byLevel: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
      };
    }
    const level = getPlainLevelScore(c);
    const currentLevel = normalizeLevel(c.currentLevel);
    map[part].count += 1;
    map[part].totalLevelScore += level;
    if (currentLevel >= 1 && currentLevel <= 5) {
      map[part].byLevel[`level${currentLevel}`] += 1;
    }
  });

  const buildRow = (part, row) => ({
    part,
    label: PART_LABELS[part] || part,
    count: row.count,
    avgScore: row.count ? row.totalLevelScore / row.count : 0,
    byLevel: row.byLevel,
  });

  const known = PART_ORDER.filter((p) => map[p]).map((part) => buildRow(part, map[part]));

  const extra = Object.keys(map)
    .filter((p) => !PART_ORDER.includes(p))
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((part) => buildRow(part, map[part]));

  return [...known, ...extra];
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
        totalLevelScore: 0,
      };
    }
    const level = getPlainLevelScore(c);
    map[deptId].count += 1;
    map[deptId].totalLevelScore += level;
  });

  const rows = Object.values(map)
    .map((row) => ({
      ...row,
      avgScore: row.count ? row.totalLevelScore / row.count : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildBelowLevel4(criteriaList) {
  return criteriaList
    .filter((c) => getCriteriaLevel(c) < 4)
    .map((c) => ({
      _id: c._id,
      code: c.code,
      name: c.name,
      currentLevel: getCriteriaLevel(c),
      expectedLevel: c.expectedLevel,
      departmentName: getDepartmentName(c),
      part: c.part,
      chapter: c.chapter,
    }));
}

function getEffectiveCurrentLevel(criteria) {
  return getCriteriaLevel(criteria);
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

function isSubcriteriaDone(sub) {
  return sub.status === true || sub.status === 'true';
}

function getLevelSubCriterias(criteria, levelNumber) {
  const level = (criteria.levels || []).find((item) => Number(item.levelNumber) === levelNumber);
  return level?.subCriterias || [];
}

function getSubcriteriaOrderNumber(criteria, levelNumber, subIndex) {
  const countBefore = (criteria.levels || [])
    .filter((level) => Number(level.levelNumber) < levelNumber)
    .reduce((acc, level) => acc + (level.subCriterias?.length || 0), 0);
  return countBefore + subIndex + 1;
}

function collectNotAchievedSubcriteriaItems(criteria) {
  const currentLevel = getEffectiveCurrentLevel(criteria);
  const expectedLevel = getEffectiveExpectedLevel(criteria);
  const items = [];

  const pushSubItem = (levelNumber, sub, subIndex, options) => {
    const text = String(sub.text || '').trim();
    if (!text) return;
    items.push({
      levelNumber,
      subcriteriaText: text,
      subIndex,
      subOrderNumber: getSubcriteriaOrderNumber(criteria, levelNumber, subIndex),
      isDone: options.isDone,
      highlightRed: options.highlightRed,
    });
  };

  if (currentLevel === 0) {
    [2, 3, 4, 5].forEach((levelNumber) => {
      if (levelNumber > expectedLevel) return;
      getLevelSubCriterias(criteria, levelNumber).forEach((sub, subIndex) => {
        if (!isSubcriteriaDone(sub)) {
          pushSubItem(levelNumber, sub, subIndex, { isDone: false, highlightRed: false });
        }
      });
    });
  } else if (currentLevel === 1) {
    getLevelSubCriterias(criteria, 1).forEach((sub, subIndex) => {
      pushSubItem(1, sub, subIndex, {
        isDone: isSubcriteriaDone(sub),
        highlightRed: true,
      });
    });

    for (let levelNumber = 2; levelNumber <= expectedLevel; levelNumber += 1) {
      getLevelSubCriterias(criteria, levelNumber).forEach((sub, subIndex) => {
        if (!isSubcriteriaDone(sub)) {
          pushSubItem(levelNumber, sub, subIndex, { isDone: false, highlightRed: false });
        }
      });
    }
  } else {
    for (let levelNumber = 2; levelNumber <= expectedLevel; levelNumber += 1) {
      getLevelSubCriterias(criteria, levelNumber).forEach((sub, subIndex) => {
        if (!isSubcriteriaDone(sub)) {
          pushSubItem(levelNumber, sub, subIndex, { isDone: false, highlightRed: false });
        }
      });
    }
  }

  return items;
}

function buildNotAchievedSubcriteria(criteriaList) {
  const sorted = [...criteriaList]
    .filter(isCriteriaNotAchieved)
    .sort(sortCriteriaForMatrix);

  const rows = [];
  let stt = 0;

  sorted.forEach((c) => {
    const currentLevel = getEffectiveCurrentLevel(c);
    const expectedLevel = getEffectiveExpectedLevel(c);
    const departmentName = getDepartmentName(c);
    const subItems = collectNotAchievedSubcriteriaItems(c);

    if (subItems.length === 0) {
      return;
    }

    subItems.forEach((sub, groupIndex) => {
      stt += 1;
      rows.push({
        stt,
        criteriaId: String(c._id),
        code: c.code,
        criteriaName: c.name,
        groupIndex,
        groupSize: subItems.length,
        currentLevel,
        expectedLevel,
        levelNumber: sub.levelNumber,
        subcriteriaText: sub.subcriteriaText,
        subOrderNumber: sub.subOrderNumber,
        isDone: sub.isDone,
        highlightRed: sub.highlightRed,
        expectedLevelCompletionDate: c.expectedLevelCompletionDate,
        departmentName,
        note: '',
      });
    });
  });

  return rows;
}

function sortCriteriaForMatrix(a, b) {
  const partCmp = normalizePartKey(a).localeCompare(normalizePartKey(b), 'vi');
  if (partCmp !== 0) return partCmp;
  const chapterCmp = normalizeChapterKey(a.chapter, a.code).localeCompare(
    normalizeChapterKey(b.chapter, b.code),
    'vi',
  );
  if (chapterCmp !== 0) return chapterCmp;
  return String(a.code || '').localeCompare(String(b.code || ''), 'vi');
}

function buildMatrixGrouped(criteriaDetails) {
  const sorted = [...criteriaDetails].sort(sortCriteriaForMatrix);
  const partCounts = {};
  sorted.forEach((c) => {
    const p = normalizePartKey(c);
    if (p) partCounts[p] = (partCounts[p] || 0) + 1;
  });

  const rows = [];
  let lastPartKey = null;
  let lastChapter = null;

  sorted.forEach((c) => {
    const partKey = normalizePartKey(c);
    const partRaw = String(c.part || '').trim();
    const chapter = String(c.chapter || '').trim();

    if (partKey && partKey !== lastPartKey) {
      const partLabel = PART_LABELS[partKey] || partKey;
      const partTitle = partRaw.length > 2 ? partRaw : `${partKey}. ${partLabel}`;
      rows.push({
        rowType: 'part',
        code: '',
        name: `PHẦN ${partTitle.toUpperCase()} (${partCounts[partKey] || 0})`,
        currentLevel: '',
        expectedLevel: '',
        departmentName: '',
      });
      lastPartKey = partKey;
      lastChapter = null;
    }

    if (chapter && chapter !== lastChapter) {
      const chapterItems = sorted.filter(
        (item) =>
          normalizePartKey(item) === partKey && String(item.chapter || '').trim() === chapter,
      );
      rows.push({
        rowType: 'chapter',
        code: normalizeChapterKey(chapter, c.code),
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
  normalizePartKey,
  normalizeChapterKey,
  isExcludedFromEvaluation,
  buildCriteriaDetail,
  buildSummary,
  buildBelowLevel4,
  buildNotAchievedCriteria,
  buildNotAchievedSubcriteria,
  collectNotAchievedSubcriteriaItems,
  buildMatrixGrouped,
};
