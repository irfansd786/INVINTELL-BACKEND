const express = require('express');
const router = express.Router();
const ops = require('../controllers/operationsController');

// Suppliers & Movements
router.get('/suppliers', ops.getSuppliers);
router.get('/stock-movements', ops.getStockMovements);

// Allocations
router.get('/allocations', ops.getAllocations);
router.post('/allocations', ops.performAllocation);

// Picking
router.get('/picking', ops.getPicking);
router.post('/picking/:id/complete', ops.completePickingTask);

// Packing
router.get('/packing', ops.getPacking);
router.post('/packing/:id/complete', ops.completePackingTask);

// Dispatch
router.get('/dispatch', ops.getDispatch);
router.post('/dispatch/:id/confirm', ops.confirmDispatch);

// Exceptions
router.get('/exceptions', ops.getExceptions);
router.post('/exceptions', ops.createException);
router.patch('/exceptions/:id/resolve', ops.resolveException);

// Transfers
router.get('/transfers', ops.getTransfers);
router.post('/transfers', ops.createTransfer);

module.exports = router;
