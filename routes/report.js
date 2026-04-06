const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

// Endpoint báo cáo chất lượng
router.post('/quality', auth, reportController.getReport);

module.exports = router;
