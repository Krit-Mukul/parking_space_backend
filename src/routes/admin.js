const express = require('express');
const router = express.Router();
const { authMiddleware, permit } = require('../middleware/auth');
const admin = require('../controllers/adminController');

router.use(authMiddleware, permit(['admin']));

router.get('/slots', admin.listSlots);
router.post('/slots', admin.createSlot);
router.put('/slots/:id', admin.updateSlot);
router.get('/report', admin.generateReport);
router.get('/validate-ticket/:id', admin.validateTicket);
router.get('/payments', admin.listPayments);
router.get('/reservations', admin.listReservations);

module.exports = router;
