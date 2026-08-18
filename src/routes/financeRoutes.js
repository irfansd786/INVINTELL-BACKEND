const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

router.get('/summary', financeController.getFinanceSummary);
router.get('/product-performance', financeController.getProductPerformance);
router.get('/warehouse-performance', financeController.getWarehousePerformance);

module.exports = router;
