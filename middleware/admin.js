// Phòng Quản lý chất lượng (quality_admin) có quyền quản trị; giữ 'admin' để tương thích ngược
module.exports = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'quality_admin')) {
        return next();
    }
    return res.status(403).json({ message: 'Bạn không có quyền truy cập (chỉ Phòng Quản lý chất lượng)' });
};
