const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin } = require('../controllers/adminAuthController');

// POST /api/admin/signup
router.post('/signup', registerAdmin);

// POST /api/admin/login
router.post('/login', loginAdmin);

module.exports = router;
