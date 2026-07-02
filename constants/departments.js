/** Danh sách khoa/phòng mặc định — seed vào collection departments khi khởi động. */
const DEFAULT_DEPARTMENT_NAMES = [
  'Quản lý chất lượng',
  'Hành chính quản trị',
  'Điều dưỡng',
  'Tổ chức cán bộ',
  'Dinh dưỡng',
  'Tài chính kế toán',
  'Kế hoạch tổng hợp',
  'Chỉ đạo tuyến',
  'Công nghệ thông tin',
  'Công tác xã hội',
  'Kiểm soát nhiễm khuẩn',
  'Khoa khám bệnh',
  'Xét nghiệm',
  'Dược',
  'Phụ sản',
  'Nhi',
  'Ban giám đốc',
];

/** Đổi tên khoa/phòng cũ (viết tắt) sang tên đầy đủ. */
const DEPARTMENT_RENAME_MAP = {
  QLCLBV: 'Quản lý chất lượng',
  HCQT: 'Hành chính quản trị',
  TCCB: 'Tổ chức cán bộ',
  TCKT: 'Tài chính kế toán',
  KHTH: 'Kế hoạch tổng hợp',
  CĐT: 'Chỉ đạo tuyến',
  CNTT: 'Công nghệ thông tin',
  CTXH: 'Công tác xã hội',
  KSNK: 'Kiểm soát nhiễm khuẩn',
  'Khoa KB': 'Khoa khám bệnh',
};

/** Khoa/phòng được xem toàn bộ tiêu chí. */
const GLOBAL_VIEW_DEPARTMENT_NAMES = ['Ban giám đốc', 'Quản lý chất lượng'];

/** Không gán cho tiêu chí */
const CRITERIA_EXCLUDED_DEPARTMENT_NAMES = ['Ban giám đốc'];

module.exports = {
  DEFAULT_DEPARTMENT_NAMES,
  DEPARTMENT_RENAME_MAP,
  GLOBAL_VIEW_DEPARTMENT_NAMES,
  CRITERIA_EXCLUDED_DEPARTMENT_NAMES,
};
