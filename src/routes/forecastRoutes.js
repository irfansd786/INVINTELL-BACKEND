const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', verifyFirebaseToken, requirePermission('forecast.view'), forecastController.getForecasts);

module.exports = router;
