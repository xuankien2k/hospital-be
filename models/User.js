const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Các vai trò trong hệ thống:
 * - director: Ban Giám đốc — dashboard tổng hợp, theo dõi báo cáo
 * - quality_admin: Phòng Quản lý chất lượng — quản trị tiêu chí, theo dõi tiến độ và báo cáo
 * - department: Khoa/phòng/trung tâm — cập nhật tiến độ tiêu chí được phân công, theo dõi trạng thái đơn vị
 * - criteria_officer: Cán bộ phụ trách tiêu chí — cập nhật nội dung, bổ sung minh chứng, theo dõi tình trạng đánh giá tiêu chí được giao
 * (admin, user giữ lại để tương thích dữ liệu cũ)
 */
const ROLES = ['director', 'quality_admin', 'department', 'criteria_officer', 'admin', 'user'];
const ROLES_MAIN = ['director', 'quality_admin', 'department', 'criteria_officer'];

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['director', 'quality_admin', 'department', 'criteria_officer', 'admin', 'user'],
    default: 'criteria_officer'
  }
}, { timestamps: true });

userSchema.statics.ROLES = ROLES_MAIN; // 4 vai trò chính cho form tạo/sửa user

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);
