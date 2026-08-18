const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/', inventoryController.getInventory);
router.get('/low-stock', inventoryController.getLowStock);
router.get('/out-of-stock', inventoryController.getOutOfStock);
router.get('/critical', inventoryController.getCritical);
router.get('/barcode/:barcode', inventoryController.getInventoryByBarcode);
router.get('/:productId', inventoryController.getInventoryByProductId);
router.post('/adjust', inventoryController.adjustStock);
router.post('/reconcile', inventoryController.reconcileInventory);

module.exports = router;
