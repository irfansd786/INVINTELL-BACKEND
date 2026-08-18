const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// User profile & Staff Management Endpoints (Authentication Disabled)
router.get('/me', staffController.getCurrentUserProfile);
router.get('/', staffController.getAllStaff);
router.post('/', staffController.createStaff);
router.get('/:id', staffController.getStaffById);
router.patch('/:id', staffController.updateStaff);
router.patch('/:id/status', staffController.toggleStaffStatus);
router.post('/:id/reset-password', staffController.resetStaffPassword);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
