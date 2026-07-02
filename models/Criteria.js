const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
 * Sub-schema cho từng tiểu mục của một level.
 * text: Nội dung của tiểu mục (bắt buộc).
 * status: Trạng thái hoàn thành, mặc định là false.
 */
const subCriteriaSchema = new Schema({
  text: { type: String, required: true },
  status: { type: Boolean, default: false },
  evidences: [{ type: String }]
});

/*
 * Schema cho một level của tiêu chí.
 * levelNumber: Mức từ 1 đến 5.
 * subCriterias: Mảng các tiểu mục.
 * actualCompletionDate: Ngày hoàn thành thực tế của level này.
 */
const levelSchema = new Schema({
  levelNumber: { type: Number, required: true },
  subCriterias: [subCriteriaSchema],
  actualCompletionDate: { type: Date } // Cập nhật khi tất cả các tiểu mục đạt.
});

/*
 * Schema cho tiêu chí.
 * Các trường: code, name, part, chapter, description, expectedCompletionDate, assignedUser, levels, currentLevel,
 * criteriaActualCompletionDate: Ngày hoàn thành toàn bộ tiêu chí.
 */
const criteriaSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  part: { type: String, required: true },
  chapter: { type: String, required: true },
  description: { type: String, default: '' },
  expectedCompletionDate: { type: Date },
  assignedUser: { type: Schema.Types.ObjectId, ref: 'User' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
  levels: [levelSchema],
  currentLevel: { type: Number, default: 0 }, // Tính bởi calculateCurrentLevel; 0 = chưa chọn tiểu mục.
  criteriaActualCompletionDate: { type: Date }, // Ngày hoàn thành toàn bộ tiêu chí.
  // Thêm 2 trường mới
  expectedLevel: { type: Number, default: 1 }, // Mức level dự kiến đạt được
  expectedLevelCompletionDate: { type: Date }, // Ngày dự kiến đạt được mức level này
  // true = kích hoạt (tham gia tính điểm báo cáo); false = vô hiệu (không tính điểm)
  status: { type: Boolean, default: true },
  // 0–100: tiến độ đạt mức dự kiến (so currentLevel / expectedLevel), cập nhật khi lưu
  progress: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

/**
 * Chuẩn hóa levels (plain object) để tránh lệch khi đọc từ Mongoose subdocument / Mixed.
 */
function normalizeLevelsForCalc(levelsRaw) {
  if (!levelsRaw || !Array.isArray(levelsRaw) || levelsRaw.length === 0) return [];
  let plain;
  try {
    plain = JSON.parse(JSON.stringify(levelsRaw));
  } catch (e) {
    plain = levelsRaw;
  }
  return plain.map((level) => ({
    ...level,
    levelNumber: Number(level.levelNumber),
    subCriterias: Array.isArray(level.subCriterias)
      ? level.subCriterias.map((sc) => ({
          ...sc,
          status: Boolean(sc && (sc.status === true || sc.status === 'true')),
        }))
      : [],
  }));
}

/**
 * Tính currentLevel từ mảng levels đã chuẩn hóa (cùng quy tắc deriveCurrentLevelFromLevels ở FE).
 */
function hasAnyCheckedSubcriteria(levels) {
  if (!levels || !levels.length) return false;
  return levels.some(
    (level) =>
      level.subCriterias &&
      level.subCriterias.some((sc) => sc.status === true || sc.status === 'true'),
  );
}

function calculateCurrentLevelFromNormalized(levels) {
  if (!levels || levels.length === 0) return 0;
  if (!hasAnyCheckedSubcriteria(levels)) return 0;

  const sortedLevels = levels.slice().sort((a, b) => a.levelNumber - b.levelNumber);
  const level1 = sortedLevels.find((l) => l.levelNumber === 1);
  const hasAnyLevel1Checked =
    level1 &&
    level1.subCriterias &&
    level1.subCriterias.length > 0 &&
    level1.subCriterias.some((sc) => sc.status === true);

  if (hasAnyLevel1Checked) {
    return 1;
  }

  let currentLevel = 0;
  for (const level of sortedLevels) {
    if (level.levelNumber === 1) continue;

    if (!level.subCriterias || level.subCriterias.length === 0) {
      break;
    }
    const allDone = level.subCriterias.every((sc) => sc.status === true);
    if (allDone) {
      currentLevel = level.levelNumber;
    } else {
      break;
    }
  }

  return currentLevel;
}

/**
 * Hàm helper tính currentLevel — cùng quy tắc với deriveCurrentLevelFromLevels (FE).
 * - Mức 1 có ít nhất một subCriteria được tích → 1.
 * - Không thì duyệt mức 2→5: full từng mức theo chuỗi; rỗng hoặc chưa full thì dừng.
 * - Không có tiểu mục nào được chọn → 0.
 */
function calculateCurrentLevel(levelsRaw) {
  const levels = normalizeLevelsForCalc(levelsRaw);
  return calculateCurrentLevelFromNormalized(levels);
}

/** % hoàn thành so với mức dự kiến (expectedLevel tối thiểu 1). */
function calculateProgressPercent(currentLevel, expectedLevel) {
  const exp = Math.max(1, Number(expectedLevel));
  const cur = Number(currentLevel);
  if (!Number.isFinite(cur)) return 0;
  if (cur >= exp) return 100;
  return Math.min(100, Math.round((cur / exp) * 100));
}

function hasAnySubcriteria(levels) {
  if (!levels || !Array.isArray(levels)) return false;
  return levels.some((l) => l.subCriterias && l.subCriterias.length > 0);
}

/** Toàn bộ tiêu chí hoàn thành: có ít nhất một tiểu mục; mọi level có tiểu mục thì tất cả đều đạt. */
function isCriteriaFullyComplete(levels) {
  if (!hasAnySubcriteria(levels)) return false;
  return levels.every((level) => {
    if (!level.subCriterias || level.subCriterias.length === 0) return true;
    return level.subCriterias.every((sc) => sc.status === true);
  });
}

// Pre-save hook: Tính currentLevel và cập nhật ngày hoàn thành tiêu chí nếu đạt mức cao nhất.
criteriaSchema.pre('save', function (next) {
  const now = new Date();
  // Duyệt qua từng level theo thứ tự tăng dần
  this.levels.forEach(level => {
    if (level.subCriterias && level.subCriterias.length > 0) {
      const allDone = level.subCriterias.every(sc => sc.status === true);
      // Nếu tất cả đạt và chưa có actualCompletionDate thì set giá trị hiện tại
      if (allDone && !level.actualCompletionDate) {
        level.actualCompletionDate = now;
      }
      // Nếu không đạt và trước đó đã có actualCompletionDate, thì xóa (hoặc giữ lại nếu nghiệp vụ cần)
      if (!allDone && level.actualCompletionDate) {
        level.actualCompletionDate = undefined;
      }
    }
  });

  const plainLevels = normalizeLevelsForCalc(this.levels);
  this.currentLevel = calculateCurrentLevelFromNormalized(plainLevels);
  this.progress = calculateProgressPercent(this.currentLevel, this.expectedLevel);

  // Hoàn thành toàn bộ tiêu chí: mọi tiểu mục (ở mọi level có dữ liệu) đều đạt
  if (isCriteriaFullyComplete(plainLevels)) {
    if (!this.criteriaActualCompletionDate) {
      this.criteriaActualCompletionDate = now;
    }
  } else {
    this.criteriaActualCompletionDate = undefined;
  }

  next();
});

const Criteria = mongoose.model('Criteria', criteriaSchema);
Criteria.calculateCurrentLevel = calculateCurrentLevel;
Criteria.normalizeLevelsForCalc = normalizeLevelsForCalc;
Criteria.calculateProgressPercent = calculateProgressPercent;
module.exports = Criteria;
