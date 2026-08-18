const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');

router.get('/demand', intelligenceController.getDemandAnalysis);
router.get('/reorder', intelligenceController.getReorderRecommendations);
router.get('/fefo-batches', intelligenceController.getFEFOBatches);
router.get('/insights', intelligenceController.getInsights);

module.exports = router;
