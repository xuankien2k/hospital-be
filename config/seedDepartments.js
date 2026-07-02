const Department = require('../models/Department');
const User = require('../models/User');
const Criteria = require('../models/Criteria');
const { DEFAULT_DEPARTMENT_NAMES } = require('../constants/departments');
const migrateDepartmentNames = require('./migrateDepartmentNames');

async function seedDepartments() {
  await migrateDepartmentNames();

  for (const name of DEFAULT_DEPARTMENT_NAMES) {
    await Department.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
  }

  const users = await User.find({
    department: { $nin: ['', null] },
    $or: [{ departmentId: { $exists: false } }, { departmentId: null }],
  });

  for (const user of users) {
    const dept = await Department.findOne({ name: String(user.department).trim() });
    if (dept) {
      user.departmentId = dept._id;
      await user.save();
    }
  }

  const criteriaList = await Criteria.find({
    departmentId: { $exists: false },
    assignedUser: { $exists: true, $ne: null },
  }).populate('assignedUser');

  for (const criteria of criteriaList) {
    const assignee = criteria.assignedUser;
    if (!assignee) continue;
    let deptId = assignee.departmentId;
    if (!deptId && assignee.department) {
      const dept = await Department.findOne({ name: String(assignee.department).trim() });
      deptId = dept?._id;
    }
    if (deptId) {
      await Criteria.updateOne({ _id: criteria._id }, { $set: { departmentId: deptId } });
    }
  }

  const banGiamDocDept = await Department.findOne({ name: 'Ban giám đốc' });
  if (banGiamDocDept) {
    const privilegedUsers = await User.find({
      $or: [
        { username: 'admin' },
        { role: 'admin' },
        { email: 'kiennguyenxuan2k@gmail.com' },
      ],
    });
    for (const user of privilegedUsers) {
      user.role = 'admin';
      user.departmentId = banGiamDocDept._id;
      user.department = banGiamDocDept.name;
      await user.save();
    }
  }
}

module.exports = seedDepartments;
