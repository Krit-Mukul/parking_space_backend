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
    
    // Check if vehicle number already exists in the system
    const existingVehicle = await Vehicle.findOne({ number: parsed.number });
    if (existingVehicle) {
      return res.status(409).json({ 
        error: 'Vehicle already registered',
        message: 'This vehicle number is already registered in the system' 
      });
    }
    
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

// Delete a vehicle
exports.deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if vehicle exists and belongs to the user
    const vehicle = await Vehicle.findOne({ _id: id, user: req.user._id });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if there are any active reservations for this vehicle
    const activeReservations = await Reservation.findOne({
      vehicle: id,
      status: 'Active'
    });

    if (activeReservations) {
      return res.status(400).json({ 
        error: 'Cannot delete vehicle with active reservations. Please cancel reservations first.' 
      });
    }

    // Delete the vehicle
    await Vehicle.findByIdAndDelete(id);
    res.json({ message: 'Vehicle deleted successfully' });
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

    // Check if the vehicle already has a reservation for the same time period
    const vehicleConflict = await Reservation.findOne({
      vehicle: parsed.vehicleId,
      status: 'Active',
      $or: [
        // New reservation starts during existing vehicle reservation
        { startAt: { $lte: startAt }, endAt: { $gte: startAt } },
        // New reservation ends during existing vehicle reservation
        { startAt: { $lte: endAt }, endAt: { $gte: endAt } },
        // New reservation completely encompasses existing vehicle reservation
        { startAt: { $gte: startAt }, endAt: { $lte: endAt } }
      ]
    }).populate('slot');

    if (vehicleConflict) {
      const conflictStart = new Date(vehicleConflict.startAt).toLocaleString('en-IN', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      });
      const conflictEnd = new Date(vehicleConflict.endAt).toLocaleString('en-IN', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      });
      
      return res.status(409).json({ 
        error: 'Vehicle already has a booking during this time',
        message: `This vehicle already has a reservation at slot ${vehicleConflict.slot?.slotNumber || 'N/A'} from ${conflictStart} to ${conflictEnd}. A vehicle cannot have multiple bookings for overlapping time periods.`,
        conflictingReservation: {
          slotNumber: vehicleConflict.slot?.slotNumber,
          startAt: vehicleConflict.startAt,
          endAt: vehicleConflict.endAt
        }
      });
    }

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
    // Get the requested time period from query parameters
    const { startAt, duration } = req.query;
    
    const slots = await ParkingSlot.find();
    
    // If no time period specified, check current availability
    const now = new Date();
    let requestedStartTime = startAt ? new Date(startAt) : now;
    let requestedEndTime = duration 
      ? new Date(requestedStartTime.getTime() + parseInt(duration) * 60 * 60 * 1000)
      : new Date(requestedStartTime.getTime() + 60 * 60 * 1000); // Default 1 hour

    // Find all active reservations that conflict with the requested time period
    const conflictingReservations = await Reservation.find({
      status: 'Active',
      $or: [
        // Reservation starts during requested period
        { startAt: { $lte: requestedStartTime }, endAt: { $gte: requestedStartTime } },
        // Reservation ends during requested period
        { startAt: { $lte: requestedEndTime }, endAt: { $gte: requestedEndTime } },
        // Reservation completely encompasses requested period
        { startAt: { $gte: requestedStartTime }, endAt: { $lte: requestedEndTime } }
      ]
    });

    // Create a map of unavailable slot IDs for the requested time period
    const unavailableSlotIds = new Set(
      conflictingReservations.map(r => r.slot?.toString()).filter(Boolean)
    );

    // Mark slots based on requested time period availability
    const slotsWithAvailability = slots.map(slot => {
      const slotId = slot._id.toString();
      const isUnavailable = unavailableSlotIds.has(slotId);
      
      return {
        ...slot.toObject(),
        // Show as Available or Reserved based on the requested time period
        status: isUnavailable ? 'Reserved' : 'Available'
      };
    });

    res.json({ slots: slotsWithAvailability });
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

