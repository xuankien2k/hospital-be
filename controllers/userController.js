const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { applyDepartmentToUser, NO_DEPARTMENT_USER_CONDITION } = require('../utils/departmentAccess');

// Danh sách vai trò và mô tả (cho dropdown admin, hiển thị profile)
const ROLE_LABELS = {
    admin: 'Quản trị viên (Admin)',
    director: 'Ban Giám đốc',
    quality_admin: 'Phòng Quản lý chất lượng',
    department: 'Khoa/phòng/trung tâm',
    criteria_officer: 'Cán bộ phụ trách tiêu chí',
};

// Lấy danh sách vai trò (cho form tạo/sửa user)
exports.getRoles = (req, res) => {
    const roles = User.ROLES.map(value => ({ value, label: ROLE_LABELS[value] || value }));
    return res.json({ message: 'OK', data: roles });
};

// Lấy profile của user đang đăng nhập
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select('-password').populate('departmentId');
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        return res.json(user);
    } catch (error) {
        console.error('Lỗi lấy profile:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body || {};

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'Vui lòng nhập đủ thông tin' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Mật khẩu mới không khớp' });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
        }

        user.password = newPassword;
        await user.save();

        return res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Admin hoặc Khoa/phòng lấy danh sách user (có phân trang, tìm kiếm). Khoa/phòng chỉ thấy user cùng đơn vị.
exports.getAllUsers = async (req, res) => {
    try {
        let { page = 1, limit = 10, keyword = '' } = req.body;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;

        const filter = {
            $or: [
                { username: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } }
            ]
        };

        // Khoa/phòng/trung tâm: xem nhân viên cùng đơn vị, chưa có đơn vị, HOẶC tất cả criteria_officer (để theo dõi/quản lý)
        if (req.user.role === 'department') {
            const currentUser = await User.findById(req.user.userId).select('department departmentId');
            const deptId = currentUser?.departmentId;
            const dept = currentUser?.department ? String(currentUser.department).trim() : '';
            const keywordPart = filter.$or ? { $or: filter.$or } : {};
            delete filter.$or;
            if (deptId) {
                filter.$and = [
                    keywordPart,
                    {
                        $or: [
                            { departmentId: deptId },
                            { department: dept },
                            ...NO_DEPARTMENT_USER_CONDITION.$or,
                            { role: 'criteria_officer' },
                        ],
                    },
                ];
            } else if (dept) {
                filter.$and = [
                    keywordPart,
                    {
                        $or: [
                            { department: dept },
                            ...NO_DEPARTMENT_USER_CONDITION.$or,
                            { role: 'criteria_officer' },
                        ],
                    },
                ];
            } else {
                filter.$and = [
                    keywordPart,
                    {
                        $or: [...NO_DEPARTMENT_USER_CONDITION.$or, { role: 'criteria_officer' }],
                    },
                ];
            }
        }

        const totalUsers = await User.countDocuments(filter);

        const users = await User.find(filter)
            .select('-password')
            .populate('departmentId')
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        return res.json({
            message: 'Lấy danh sách người dùng thành công',
            data: users,
            pagination: {
                currentPage: page,
                pageSize: limit,
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit)
            }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách user:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Admin tạo user
exports.createUser = async (req, res) => {
    try {
        const { username, password, email, department, departmentId, role } = req.body;
        const allowedRoles = User.ROLES || ['admin', 'director', 'quality_admin', 'department', 'criteria_officer'];
        const roleToUse = role && allowedRoles.includes(role) ? role : 'criteria_officer';

        // Kiểm tra username có tồn tại hay không
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
        }

        if (!departmentId) {
            return res.status(400).json({ message: 'Vui lòng chọn khoa/phòng' });
        }

        const newUser = new User({
            username,
            password,
            email,
            role: roleToUse,
        });
        await applyDepartmentToUser(newUser, departmentId || department);
        await newUser.save();

        // Loại bỏ trường password trước khi trả về thông tin user
        const userInfo = newUser.toObject();
        delete userInfo.password;

        return res.status(201).json({
            message: 'Tạo người dùng thành công',
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi tạo user:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Admin cập nhật user. Khoa/phòng chỉ được phân quyền role thành criteria_officer cho nhân viên cùng đơn vị.
exports.updateUser = async (req, res) => {
    try {
        const { _id, username, password, email, department, departmentId, role } = req.body;

        if (!_id) {
            return res.status(400).json({ message: 'Không tìm thấy _id người dùng' });
        }

        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        // Khoa/phòng chỉ được phân quyền criteria_officer: cho user cùng đơn vị hoặc chưa có đơn vị (sẽ gán luôn đơn vị)
        if (req.user.role === 'department') {
            const currentUser = await User.findById(req.user.userId).select('department departmentId');
            const myDeptId = currentUser?.departmentId;
            const myDept = currentUser && currentUser.department ? String(currentUser.department).trim() : null;
            const userDept = user.department ? String(user.department).trim() : '';
            const sameUnit =
                (myDeptId && user.departmentId && user.departmentId.toString() === myDeptId.toString()) ||
                (myDept && userDept === myDept);
            const noUnit = !user.departmentId && !userDept;
            if (!currentUser || (!sameUnit && !noUnit)) {
                return res.status(403).json({ message: 'Bạn chỉ được phân quyền cho nhân viên trong cùng đơn vị hoặc chưa có đơn vị' });
            }
            if (role !== 'criteria_officer') {
                return res.status(403).json({ message: 'Khoa/phòng chỉ được phân quyền Cán bộ phụ trách tiêu chí' });
            }
            user.role = 'criteria_officer';
            if (noUnit && myDeptId) {
                await applyDepartmentToUser(user, myDeptId);
            } else if (noUnit && myDept) {
                user.department = myDept;
            }
            await user.save();
            const userInfo = user.toObject();
            delete userInfo.password;
            return res.json({
                message: 'Phân quyền thành công',
                user: userInfo
            });
        }

        // Admin: cập nhật đầy đủ
        if (username && username !== user.username) {
            const userWithSameUsername = await User.findOne({ username });
            if (userWithSameUsername) {
                return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
            }
            user.username = username;
        }

        if (email) user.email = email;
        if (departmentId !== undefined) {
            if (!departmentId) {
                return res.status(400).json({ message: 'Vui lòng chọn khoa/phòng' });
            }
            await applyDepartmentToUser(user, departmentId);
        } else if (department !== undefined) {
            if (!department) {
                return res.status(400).json({ message: 'Vui lòng chọn khoa/phòng' });
            }
            await applyDepartmentToUser(user, department);
        }
        const allowedRoles = User.ROLES || ['admin', 'director', 'quality_admin', 'department', 'criteria_officer'];
        if (role && allowedRoles.includes(role)) user.role = role;

        if (password) {
            user.password = password;
        }

        await user.save();

        // Loại bỏ trường password trước khi trả về
        const userInfo = user.toObject();
        delete userInfo.password;

        return res.json({
            message: 'Cập nhật người dùng thành công',
            user: userInfo
        });
    } catch (error) {
        console.error('Lỗi cập nhật user:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Admin xóa user
exports.deleteUser = async (req, res) => {
    try {
        // Lấy _id hoặc mảng ids từ body
        let { ids } = req.body;

        if (!ids) {
            return res.status(400).json({ message: 'Không tìm thấy _id người dùng cần xóa' });
        }

        // Nếu ids không phải mảng, chuyển nó thành mảng
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        // Thực hiện xóa nhiều user với điều kiện _id nằm trong mảng ids
        const result = await User.deleteMany({ _id: { $in: ids } });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng cần xóa' });
        }

        return res.json({ message: 'Xóa người dùng thành công', deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Lỗi xóa user:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};
