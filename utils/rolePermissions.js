/** Quản trị viên hệ thống — đầy đủ quyền như admin cũ */
const SYSTEM_ADMIN_ROLE = 'admin';

/** Vai trò quản trị nội dung (tạo/xóa tiêu chí & user) */
const CONTENT_ADMIN_ROLES = ['admin', 'quality_admin'];

function isSystemAdmin(role) {
  return role === SYSTEM_ADMIN_ROLE;
}

function isContentAdmin(role) {
  return CONTENT_ADMIN_ROLES.includes(role);
}

function canViewAllCriteria(role) {
  return isContentAdmin(role);
}

function canUpdateUsers(role) {
  return isContentAdmin(role) || role === 'department';
}

function canCreateCriteria(role) {
  return isContentAdmin(role);
}

module.exports = {
  SYSTEM_ADMIN_ROLE,
  CONTENT_ADMIN_ROLES,
  isSystemAdmin,
  isContentAdmin,
  canViewAllCriteria,
  canUpdateUsers,
  canCreateCriteria,
};
