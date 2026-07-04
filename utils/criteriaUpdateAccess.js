const RESTRICTED_CRITERIA_EDITOR_ROLES = ['criteria_officer', 'department'];

function isRestrictedCriteriaEditor(role) {
  return RESTRICTED_CRITERIA_EDITOR_ROLES.includes(role);
}

function normalizeLevels(levels = []) {
  if (!Array.isArray(levels)) return [];
  return levels.map((level) => ({
    levelNumber: level.levelNumber,
    subCriterias: Array.isArray(level.subCriterias)
      ? level.subCriterias.map((sub) => ({
          text: String(sub.text || '').trim(),
          status: sub.status === true || sub.status === 'true',
          evidences: Array.isArray(sub.evidences)
            ? sub.evidences.filter((link) => typeof link === 'string')
            : [],
        }))
      : [],
  }));
}

function validateLevelsStructure(existingLevels, incomingLevels) {
  const existing = normalizeLevels(existingLevels);
  const incoming = normalizeLevels(incomingLevels);

  if (existing.length !== incoming.length) {
    return false;
  }

  for (let levelIdx = 0; levelIdx < existing.length; levelIdx += 1) {
    const existingLevel = existing[levelIdx];
    const incomingLevel = incoming[levelIdx];

    if (Number(existingLevel.levelNumber) !== Number(incomingLevel.levelNumber)) {
      return false;
    }

    const existingSubs = existingLevel.subCriterias || [];
    const incomingSubs = incomingLevel.subCriterias || [];
    if (existingSubs.length !== incomingSubs.length) {
      return false;
    }

    for (let subIdx = 0; subIdx < existingSubs.length; subIdx += 1) {
      if (existingSubs[subIdx].text !== incomingSubs[subIdx].text) {
        return false;
      }
    }
  }

  return true;
}

function mergeRestrictedLevelsUpdate(existingLevels, incomingLevels) {
  const existing = Array.isArray(existingLevels) ? existingLevels : [];
  const incoming = normalizeLevels(incomingLevels);

  return existing.map((level, levelIdx) => {
    const levelObj = typeof level.toObject === 'function' ? level.toObject() : { ...level };
    const incomingLevel = incoming[levelIdx];
    const existingSubs = levelObj.subCriterias || [];

    return {
      ...levelObj,
      subCriterias: existingSubs.map((sub, subIdx) => {
        const subObj = typeof sub.toObject === 'function' ? sub.toObject() : { ...sub };
        const incomingSub = incomingLevel.subCriterias[subIdx];
        return {
          ...subObj,
          text: subObj.text,
          status: Boolean(incomingSub.status),
          evidences: incomingSub.evidences,
        };
      }),
    };
  });
}

module.exports = {
  RESTRICTED_CRITERIA_EDITOR_ROLES,
  isRestrictedCriteriaEditor,
  validateLevelsStructure,
  mergeRestrictedLevelsUpdate,
};
