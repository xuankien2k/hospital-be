/** Danh sách khoa/phòng mặc định — seed vào collection departments khi khởi động. */
const DEFAULT_DEPARTMENT_NAMES = [
  'HCQT',
  'Khoa KB',
  'KHTH',
  'TCKT',
  'QLCLBV',
  'TCCB',
  'CTXH',
  'CNTT',
  'KSNK',
  'Điều dưỡng',
  'Dinh dưỡng',
  'Xét nghiệm',
  'Dược',
  'CĐT',
  'Phụ sản',
  'Nhi',
  'Ban giám đốc',
];

/** Khoa/phòng được xem toàn bộ tiêu chí. */
const GLOBAL_VIEW_DEPARTMENT_NAMES = ['Ban giám đốc', 'QLCLBV'];

/** Không gán cho tiêu chí */
const CRITERIA_EXCLUDED_DEPARTMENT_NAMES = ['Ban giám đốc'];

module.exports = {
  DEFAULT_DEPARTMENT_NAMES,
  GLOBAL_VIEW_DEPARTMENT_NAMES,
  CRITERIA_EXCLUDED_DEPARTMENT_NAMES,
};
