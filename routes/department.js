const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const departmentController = require('../controllers/departmentController');

router.get('/list', auth, departmentController.getList);

module.exports = router;
