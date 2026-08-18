const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/overview', analyticsController.getOverview);
router.get('/sales', analyticsController.getSalesAnalytics);
router.get('/inventory', analyticsController.getInventoryAnalytics);
router.get('/fulfillment', analyticsController.getFulfillmentAnalytics);
router.get('/', analyticsController.getOverview);

module.exports = router;
