const express = require('express');
const router = express.Router();
const bulkController = require('../controllers/bulkController');
const { verifyFirebaseToken, requirePermission } = require('../middleware/authMiddleware');

router.post('/import-products/validate', verifyFirebaseToken, requirePermission('products.create'), bulkController.validateProductsImport);
router.post('/import-products/confirm', verifyFirebaseToken, requirePermission('products.create'), bulkController.confirmProductsImport);
router.get('/export/:entityType', verifyFirebaseToken, bulkController.exportBulkCSV);

module.exports = router;
