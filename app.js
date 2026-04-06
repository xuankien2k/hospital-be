// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const criteriaRoutes = require('./routes/criteria');
const reportRoutes = require('./routes/report');
const app = express();

// Kết nối DB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Thêm routes cho tiêu chí
app.use('/api/criteria', criteriaRoutes);
app.use('/api/report', reportRoutes);
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
