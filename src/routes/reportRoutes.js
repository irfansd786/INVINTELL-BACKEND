const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/:reportType', verifyFirebaseToken, requirePermission('reports.view'), reportController.getReportData);

module.exports = router;
