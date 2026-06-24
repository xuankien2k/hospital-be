const Department = require('../models/Department');

exports.getList = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    return res.json({
      message: 'Lấy danh sách khoa/phòng thành công',
      data: departments,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách khoa/phòng:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};
