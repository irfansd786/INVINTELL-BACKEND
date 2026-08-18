const express = require('express');
const router = express.Router();
const riskController = require('../controllers/riskController');

router.get('/', riskController.getRisks);
router.post('/:id/apply', riskController.applyRiskRecommendation);
router.post('/:id/modify', riskController.modifyRiskRecommendation);

module.exports = router;
