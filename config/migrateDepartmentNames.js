const Department = require('../models/Department');
const User = require('../models/User');
const { DEPARTMENT_RENAME_MAP } = require('../constants/departments');

async function migrateDepartmentNames() {
  for (const [oldName, newName] of Object.entries(DEPARTMENT_RENAME_MAP)) {
    const existingNew = await Department.findOne({ name: newName });
    const oldDept = await Department.findOne({ name: oldName });

    if (oldDept) {
      if (existingNew && String(existingNew._id) !== String(oldDept._id)) {
        await User.updateMany({ departmentId: oldDept._id }, { $set: { departmentId: existingNew._id, department: newName } });
        await Department.deleteOne({ _id: oldDept._id });
      } else {
        oldDept.name = newName;
        await oldDept.save();
      }
      await User.updateMany({ department: oldName }, { $set: { department: newName } });
    }
  }
}

module.exports = migrateDepartmentNames;
