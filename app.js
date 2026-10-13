// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const criteriaRoutes = require('./routes/criteria');
const reportRoutes = require('./routes/report');
const departmentRoutes = require('./routes/department');
const { startMonthlySnapshotScheduler } = require('./jobs/monthlySnapshotScheduler');
const { getCorsOptions } = require('./utils/corsConfig');
const app = express();

// Kết nối DB
connectDB();

// Middleware
app.use(express.json());
app.use(cors(getCorsOptions()));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hospital-api' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Thêm routes cho tiêu chí
app.use('/api/criteria', criteriaRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/departments', departmentRoutes);
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.ENABLE_SNAPSHOT_SCHEDULER !== 'false') {
    startMonthlySnapshotScheduler();
  } else {
    console.log('[snapshot] In-process scheduler disabled (use Railway cron or ENABLE_SNAPSHOT_SCHEDULER)');
  }
});
