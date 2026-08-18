const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { verifyFirebaseToken } = require('../middleware/authMiddleware');

router.get('/', verifyFirebaseToken, searchController.globalSearch);

module.exports = router;
