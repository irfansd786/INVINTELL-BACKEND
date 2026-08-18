const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', verifyFirebaseToken, requirePermission('audit.view'), auditController.getAuditLogs);

module.exports = router;
