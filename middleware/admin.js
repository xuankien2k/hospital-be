const { isContentAdmin } = require('../utils/rolePermissions');

// Phòng Quản lý chất lượng (quality_admin) và Quản trị viên (admin) có quyền quản trị
module.exports = (req, res, next) => {
    if (req.user && isContentAdmin(req.user.role)) {
        return next();
    }
    return res.status(403).json({ message: 'Bạn không có quyền truy cập (chỉ Phòng Quản lý chất lượng)' });
};
