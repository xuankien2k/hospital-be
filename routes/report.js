const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Endpoint báo cáo chất lượng
router.post('/quality', auth, reportController.getReport);
router.post('/quality/export', auth, reportController.exportReport);

// Báo cáo xu hướng theo snapshot tháng
router.post('/trends', auth, reportController.getTrends);
router.get('/snapshots', auth, reportController.getSnapshots);
router.post('/snapshot', auth, admin, reportController.captureSnapshot);

module.exports = router;
