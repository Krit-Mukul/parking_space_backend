const Vehicle = require('../models/Vehicle');
const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const ParkingSlot = require('../models/ParkingSlot');
const { vehicleSchema } = require('../validators/vehicleValidator');
const { reservationSchema } = require('../validators/reservationValidator');
const { paymentSchema } = require('../validators/paymentValidator');

// Add a vehicle
exports.addVehicle = async (req, res, next) => {
  try {
    const parsed = vehicleSchema.parse(req.body);
    const vehicle = await Vehicle.create({ ...parsed, user: req.user._id });
    res.json({ vehicle });
  } catch (err) {
    next(err);
  }
};

// List all vehicles for a user
exports.listVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ user: req.user._id });
    res.json({ vehicles });
  } catch (err) {
    next(err);
  }
};

// Create reservation
exports.createReservation = async (req, res, next) => {
  try {
    const parsed = reservationSchema.parse(req.body);

    // Find the parking slot by slot number if provided
    let slotId = parsed.slotId;
    if (parsed.slotNumber && !slotId) {
      const slot = await ParkingSlot.findOne({ slotNumber: parsed.slotNumber });
      if (!slot) {
        return res.status(404).json({ error: 'Parking slot not found' });
      }
      slotId = slot._id;
    }

    // Calculate end time based on duration
    const startAt = new Date(parsed.startAt);
    const duration = parsed.duration || 1;
    const endAt = new Date(startAt.getTime() + duration * 60 * 60 * 1000);

    // Check if the slot is available for the requested time period
    const conflictingReservation = await Reservation.findOne({
      slot: slotId,
      status: 'Active',
      $or: [
        // New reservation starts during existing reservation
        { startAt: { $lte: startAt }, endAt: { $gte: startAt } },
        // New reservation ends during existing reservation
        { startAt: { $lte: endAt }, endAt: { $gte: endAt } },
        // New reservation completely encompasses existing reservation
        { startAt: { $gte: startAt }, endAt: { $lte: endAt } }
      ]
    });

    if (conflictingReservation) {
      return res.status(400).json({ 
        error: 'Parking slot is already reserved for the selected time period',
        conflictingReservation: {
          startAt: conflictingReservation.startAt,
          endAt: conflictingReservation.endAt
        }
      });
    }

    // Calculate total amount (assuming $10 per hour as base rate)
    const hourlyRate = 10;
    const totalAmount = duration * hourlyRate;

    const reservation = await Reservation.create({
      user: req.user._id,
      vehicle: parsed.vehicleId,
      slot: slotId,
      startAt,
      endAt,
      duration,
      totalAmount,
    });

    // Update slot status based on timing
    const now = new Date();
    const slot = await ParkingSlot.findById(slotId);
    if (slot) {
      if (startAt <= now && endAt >= now) {
        // Reservation is for current time
        slot.status = 'Occupied';
      } else {
        // Reservation is for future time
        slot.status = 'Reserved';
      }
      await slot.save();
    }

    res.json({ reservation });
  } catch (err) {
    console.error('Reservation creation error:', err.errors || err.message);
    next(err);
  }
};

// List all reservations for a driver
exports.listReservations = async (req, res, next) => {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate('vehicle')
      .populate('slot');
    res.json({ reservations });
  } catch (err) {
    next(err);
  }
};

// Make payment
exports.makePayment = async (req, res, next) => {
  try {
    const parsed = paymentSchema.parse(req.body);
    
    // Create payment
    const payment = await Payment.create({ 
      user: req.user._id,
      reservation: parsed.reservationId,
      amount: parsed.amount,
      method: parsed.method,
    });

    // Update reservation payment status
    const reservation = await Reservation.findById(parsed.reservationId);
    if (reservation) {
      reservation.paymentStatus = 'paid';
      await reservation.save();
    }

    res.json({ payment });
  } catch (err) {
    console.error('Payment error:', err.errors || err.message);
    next(err);
  }
};

// List available parking slots
exports.listAvailableSlots = async (req, res, next) => {
  try {
    const slots = await ParkingSlot.find();
    
    // Update slot statuses based on current time and active reservations
    const now = new Date();
    const activeReservations = await Reservation.find({
      status: 'Active',
      startAt: { $lte: now },
      endAt: { $gte: now }
    });

    // Create a map of occupied slot IDs
    const occupiedSlotIds = new Set(
      activeReservations.map(r => r.slot?.toString()).filter(Boolean)
    );

    // Update each slot's status
    for (const slot of slots) {
      const slotId = slot._id.toString();
      const hasActiveReservation = occupiedSlotIds.has(slotId);
      
      // Check for upcoming reservations (Reserved status)
      const upcomingReservation = await Reservation.findOne({
        slot: slot._id,
        status: 'Active',
        startAt: { $gt: now }
      });

      if (hasActiveReservation) {
        // Slot is currently being used
        if (slot.status !== 'Occupied') {
          slot.status = 'Occupied';
          await slot.save();
        }
      } else if (upcomingReservation) {
        // Slot has a future reservation
        if (slot.status !== 'Reserved') {
          slot.status = 'Reserved';
          await slot.save();
        }
      } else {
        // Slot is available
        if (slot.status !== 'Available') {
          slot.status = 'Available';
          await slot.save();
        }
      }
    }

    // Fetch updated slots
    const updatedSlots = await ParkingSlot.find();
    res.json({ slots: updatedSlots });
  } catch (err) {
    next(err);
  }
};

// Cancel reservation
exports.cancelReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const reservation = await Reservation.findOne({
      _id: id,
      user: req.user._id
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status === 'Cancelled') {
      return res.status(400).json({ error: 'Reservation already cancelled' });
    }

    // Update reservation status
    reservation.status = 'Cancelled';
    await reservation.save();

    // Free up the parking slot if it was reserved/occupied
    if (reservation.slot) {
      const slot = await ParkingSlot.findById(reservation.slot);
      if (slot && (slot.status === 'Reserved' || slot.status === 'Occupied')) {
        slot.status = 'Available';
        await slot.save();
      }
    }

    res.json({ message: 'Reservation cancelled successfully', reservation });
  } catch (err) {
    console.error('Cancel reservation error:', err.message);
    next(err);
  }
};

