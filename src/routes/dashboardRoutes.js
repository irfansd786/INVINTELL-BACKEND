const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/sales', dashboardController.getDashboardSales);
router.get('/inventory', dashboardController.getDashboardInventory);
router.get('/top-products', dashboardController.getDashboardTopProducts);
router.get('/low-stock', dashboardController.getDashboardLowStock);

module.exports = router;
