// Danh sách user: chỉ chặn criteria_officer (director, quality_admin, admin, department đều được gọi)
const canListUsers = (req, res, next) => {
    const role = req.user && req.user.role;
    if (role && role !== 'criteria_officer') {
        return next();
    }
    return res.status(403).json({ message: 'Chỉ Cán bộ phụ trách tiêu chí không có quyền xem danh sách người dùng' });
};

// Cập nhật user / phân quyền: chỉ admin, quality_admin, department (để Khoa/phòng phân quyền Cán bộ tiêu chí)
const canUpdateUsers = (req, res, next) => {
    const role = req.user && req.user.role;
    if (role === 'admin' || role === 'quality_admin' || role === 'department') {
        return next();
    }
    return res.status(403).json({ message: 'Bạn không có quyền cập nhật người dùng' });
};

// Quản lý tiêu chí (update): admin, quality_admin, department, director, criteria_officer
// Lưu ý: quyền chi tiết của criteria_officer (chỉ sửa tiêu chí được giao; không đổi status) được kiểm tra thêm ở controller.
const canManageCriteria = (req, res, next) => {
    const role = req.user && req.user.role;
    if (role === 'admin' || role === 'quality_admin' || role === 'department' || role === 'director' || role === 'criteria_officer') {
        return next();
    }
    return res.status(403).json({ message: 'Bạn không có quyền quản lý tiêu chí' });
};

module.exports = { canListUsers, canUpdateUsers, canManageCriteria };
