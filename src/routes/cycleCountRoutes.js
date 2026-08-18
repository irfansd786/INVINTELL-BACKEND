const express = require('express');
const router = express.Router();
const cycleCountController = require('../controllers/cycleCountController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', verifyFirebaseToken, cycleCountController.getCycleCounts);
router.post('/', verifyFirebaseToken, requirePermission('inventory.edit'), cycleCountController.createCycleCount);
router.get('/:id', verifyFirebaseToken, cycleCountController.getCycleCountById);
router.post('/:id/items', verifyFirebaseToken, requirePermission('inventory.edit'), cycleCountController.updateCountItem);
router.post('/:id/complete', verifyFirebaseToken, requirePermission('inventory.edit'), cycleCountController.completeCycleCount);

module.exports = router;
