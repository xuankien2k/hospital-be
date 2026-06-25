/** Tổng số tiêu chí chuẩn bộ tiêu chí BV Việt Nam */
const TOTAL_CRITERIA_STANDARD = 83;

/** Không áp dụng đánh giá (80/83 trên báo cáo) */
const EXCLUDED_CRITERIA_CODES = ['C4.5', 'C4.6', 'C5.1'];

const PART_LABELS = {
  A: 'Hướng đến người bệnh',
  B: 'Phát triển nguồn nhân lực',
  C: 'Hoạt động chuyên môn',
  D: 'Cải tiến chất lượng',
  E: 'Tiêu chí chuyên khoa',
};

const PART_ORDER = ['A', 'B', 'C', 'D', 'E'];

module.exports = {
  TOTAL_CRITERIA_STANDARD,
  EXCLUDED_CRITERIA_CODES,
  PART_LABELS,
  PART_ORDER,
};
