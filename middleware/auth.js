const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy token, từ chối truy cập' });
  }

  try {
    const decoded = jwt.verify(token, 'secret_jwt_key'); // thay bằng secret thật
    req.user = decoded; // chứa { userId, role }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
};
