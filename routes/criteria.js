const express = require('express');
const router = express.Router();
const criteriaController = require('../controllers/criteriaController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { canManageCriteria, canCreateCriteria } = require('../middleware/adminOrDepartment');

// Tạo tiêu chí (admin, quality_admin)
router.post('/create', auth, canCreateCriteria, criteriaController.createCriteria);

// Cập nhật tiêu chí (admin hoặc Khoa/phòng — để chỉnh sửa, phân công)
router.post('/update', auth, canManageCriteria, criteriaController.updateCriteria);

// Xóa tiêu chí (chỉ admin)
router.post('/delete', auth, admin, criteriaController.deleteCriteria);

// Lấy danh sách tiêu chí
router.post('/list', auth, criteriaController.getList);

// Lấy chi tiết tiêu chí
router.post('/detail', auth, criteriaController.getDetail);

module.exports = router;
