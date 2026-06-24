const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_key';

// Đăng ký
exports.register = async (req, res) => {
  try {
    const { username, password, email, department } = req.body;

    // Kiểm tra user đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
    }

    // Tạo user
    const newUser = new User({
      username,
      password,
      email,
      department
    });
    await newUser.save();

    return res.status(201).json({ message: 'Đăng ký tài khoản thành công' });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    // Tạo token KHÔNG giới hạn thời gian
    // => Không truyền expiresIn vào sign
    const payload = {
      userId: user._id,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET); 

    return res.json({
      message: 'Đăng nhập thành công',
      token
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};
