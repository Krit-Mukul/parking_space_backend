const express = require('express');
const router = express.Router();
const { authMiddleware, permit } = require('../middleware/auth');
const driver = require('../controllers/driverController');

router.use(authMiddleware, permit(['driver']));

router.post('/vehicles', driver.addVehicle);
router.get('/vehicles', driver.listVehicles);
router.get('/slots', driver.listAvailableSlots);
router.post('/reserve', driver.createReservation);
router.get('/reservations', driver.listReservations);
router.delete('/reservations/:id', driver.cancelReservation);
router.post('/pay', driver.makePayment);

module.exports = router;
