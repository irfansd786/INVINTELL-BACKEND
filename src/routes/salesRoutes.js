const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.get('/', salesController.getSales);
router.get('/summary', salesController.getSalesSummary);
router.get('/trends', salesController.getSalesTrends);

module.exports = router;
