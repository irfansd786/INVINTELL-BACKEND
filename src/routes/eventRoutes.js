const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', verifyFirebaseToken, eventController.getEvents);
router.post('/', verifyFirebaseToken, requirePermission('analytics.view'), eventController.createEvent);

module.exports = router;
