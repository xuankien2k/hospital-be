const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { canListUsers, canUpdateUsers } = require('../middleware/adminOrDepartment');

// Lấy danh sách vai trò (cần đăng nhập)
router.get('/roles', auth, userController.getRoles);
// User thường: xem profile
router.get('/profile', auth, userController.getProfile);
router.post('/change-password', auth, userController.changePassword);

// Chỉ criteria_officer không được gọi list; Khoa/phòng chỉ thấy user cùng đơn vị
router.post('/list', auth, canListUsers, userController.getAllUsers);
// Chỉ admin, quality_admin, department được cập nhật (Khoa/phòng chỉ phân quyền Cán bộ tiêu chí)
router.post('/update', auth, canUpdateUsers, userController.updateUser);

// Chỉ Admin: tạo user, xóa user
router.post('/create', auth, admin, userController.createUser);
router.post('/delete', auth, admin, userController.deleteUser);

module.exports = router;
