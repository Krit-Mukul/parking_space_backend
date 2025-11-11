const ParkingSlot = require('../models/ParkingSlot');
const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const User = require('../models/User');

exports.listSlots = async (req, res, next) => {
  try {
    const slots = await ParkingSlot.find();
    res.json({ slots });
  } catch (err) {
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const { slotNumber } = req.body;
    const slot = await ParkingSlot.create({ slotNumber });
    res.json({ slot });
  } catch (err) {
    next(err);
  }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const slot = await ParkingSlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ slot });
  } catch (err) {
    next(err);
  }
};

exports.generateReport = async (req, res, next) => {
  try {
    const totalSlots = await ParkingSlot.countDocuments();
    const occupiedSlots = await ParkingSlot.countDocuments({ status: 'Occupied' });
    const activeReservations = await Reservation.countDocuments({ status: 'Active' });
    const totalPayments = await Payment.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'driver' });
    
    const revenueResult = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      totalSlots,
      occupiedSlots,
      activeReservations,
      totalPayments,
      totalRevenue: revenueResult[0]?.total || 0,
      totalUsers,
    });
  } catch (err) {
    next(err);
  }
};

// Validate ticket/reservation
exports.validateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const reservation = await Reservation.findById(id)
      .populate('vehicle')
      .populate('slot')
      .populate('user', 'name email');

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({ reservation });
  } catch (err) {
    console.error('Validate ticket error:', err.message);
    next(err);
  }
};

// Get all payments with details
exports.listPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('reservation')
      .sort({ createdAt: -1 });

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err.message);
    next(err);
  }
};

// Get all reservations with details
exports.listReservations = async (req, res, next) => {
  try {
    const reservations = await Reservation.find({ status: 'Active' })
      .populate('user', 'name email')
      .populate('vehicle')
      .populate('slot')
      .sort({ startAt: 1 });

    res.json({ reservations });
  } catch (err) {
    console.error('List reservations error:', err.message);
    next(err);
  }
};
