const Department = require('../models/Department');
const { canViewAllCriteria } = require('./rolePermissions');
const User = require('../models/User');
const mongoose = require('mongoose');
const { GLOBAL_VIEW_DEPARTMENT_NAMES } = require('../constants/departments');

async function getUserWithDepartment(userId) {
  if (!userId) return null;
  return User.findById(userId).populate('departmentId');
}

function getDepartmentName(user) {
  if (!user) return '';
  if (user.departmentId && typeof user.departmentId === 'object' && user.departmentId.name) {
    return user.departmentId.name;
  }
  return user.department ? String(user.department).trim() : '';
}

async function userCanViewAllCriteria(userId, role) {
  if (canViewAllCriteria(role)) return true;

  const user = await getUserWithDepartment(userId);
  const name = getDepartmentName(user);
  return GLOBAL_VIEW_DEPARTMENT_NAMES.includes(name);
}

const NO_DEPARTMENT_CRITERIA_CONDITION = {
  $or: [{ departmentId: null }, { departmentId: { $exists: false } }],
};

const NO_DEPARTMENT_USER_CONDITION = {
  $or: [
    { departmentId: null },
    { departmentId: { $exists: false } },
    { department: { $in: ['', null] } },
    { department: { $exists: false } },
  ],
};

async function getCriteriaDepartmentFilter(userId, role) {
  if (await userCanViewAllCriteria(userId, role)) return null;

  const user = await getUserWithDepartment(userId);
  let deptId = null;

  if (user?.departmentId) {
    deptId = user.departmentId._id || user.departmentId;
  } else {
    const legacyName = user?.department ? String(user.department).trim() : '';
    if (legacyName) {
      const dept = await Department.findOne({ name: legacyName });
      deptId = dept?._id;
    }
  }

  if (deptId) {
    return {
      $or: [{ departmentId: deptId }, ...NO_DEPARTMENT_CRITERIA_CONDITION.$or],
    };
  }

  return NO_DEPARTMENT_CRITERIA_CONDITION;
}

function getCriteriaDepartmentId(criteria) {
  if (!criteria) return null;
  return criteria.departmentId?._id || criteria.departmentId || null;
}

async function getUserDepartmentId(userId) {
  const user = await getUserWithDepartment(userId);
  if (!user) return null;

  if (user.departmentId) {
    return user.departmentId._id || user.departmentId;
  }

  const legacyName = user.department ? String(user.department).trim() : '';
  if (!legacyName) return null;

  const dept = await Department.findOne({ name: legacyName });
  return dept?._id || null;
}

/** Cùng phạm vi với bộ lọc danh sách tiêu chí (getCriteriaDepartmentFilter). */
async function userCanAccessCriteria(userId, role, criteria) {
  if (await userCanViewAllCriteria(userId, role)) return true;

  const userDeptId = await getUserDepartmentId(userId);
  const criteriaDeptId = getCriteriaDepartmentId(criteria);

  if (userDeptId) {
    if (!criteriaDeptId) return true;
    return String(criteriaDeptId) === String(userDeptId);
  }

  return !criteriaDeptId;
}

async function resolveDepartmentId(departmentId) {
  if (!departmentId) return null;
  const dept = await Department.findById(departmentId);
  return dept;
}

async function applyDepartmentToUser(user, departmentIdOrName) {
  if (!departmentIdOrName) {
    user.departmentId = null;
    user.department = '';
    return null;
  }

  let dept = null;
  if (mongoose.Types.ObjectId.isValid(String(departmentIdOrName))) {
    dept = await Department.findById(departmentIdOrName);
  }
  if (!dept) {
    dept = await Department.findOne({ name: String(departmentIdOrName).trim() });
  }

  if (dept) {
    user.departmentId = dept._id;
    user.department = dept.name;
    return dept;
  }

  user.department = String(departmentIdOrName).trim();
  return null;
}

async function applyDepartmentToCriteria(criteria, departmentIdOrName) {
  if (!departmentIdOrName) {
    criteria.departmentId = null;
    return null;
  }

  let dept = null;
  if (mongoose.Types.ObjectId.isValid(String(departmentIdOrName))) {
    dept = await Department.findById(departmentIdOrName);
  }
  if (!dept) {
    dept = await Department.findOne({ name: String(departmentIdOrName).trim() });
  }

  if (dept) {
    criteria.departmentId = dept._id;
    return dept;
  }

  return null;
}

/** Điều kiện lọc theo khoa/phòng khi user chọn bộ lọc (ObjectId chuẩn). */
function buildDepartmentIdFilter(departmentId) {
  if (!departmentId || !mongoose.Types.ObjectId.isValid(String(departmentId))) {
    return null;
  }
  return { departmentId: new mongoose.Types.ObjectId(String(departmentId)) };
}

/** Trưởng khoa/phòng chỉ được gán tiêu chí vào khoa/phòng của mình. */
async function assertDepartmentHeadCanAssignDepartment(userId, departmentId) {
  const user = await getUserWithDepartment(userId);
  const userDeptId = user?.departmentId?._id || user?.departmentId;
  if (!userDeptId) {
    return { ok: false, message: 'Tài khoản chưa được gán khoa/phòng' };
  }
  if (String(userDeptId) !== String(departmentId)) {
    return { ok: false, message: 'Trưởng khoa/phòng chỉ được tạo tiêu chí thuộc khoa/phòng của mình' };
  }
  return { ok: true };
}

module.exports = {
  getUserWithDepartment,
  getDepartmentName,
  userCanViewAllCriteria,
  getCriteriaDepartmentFilter,
  getUserDepartmentId,
  getCriteriaDepartmentId,
  userCanAccessCriteria,
  resolveDepartmentId,
  applyDepartmentToUser,
  applyDepartmentToCriteria,
  buildDepartmentIdFilter,
  assertDepartmentHeadCanAssignDepartment,
  NO_DEPARTMENT_USER_CONDITION,
};
