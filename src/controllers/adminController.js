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
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        dateFilter.createdAt.$lt = endDateTime;
      }
    }

    // Build reservation date filter
    let reservationDateFilter = {};
    if (startDate || endDate) {
      reservationDateFilter.startAt = {};
      if (startDate) {
        reservationDateFilter.startAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        reservationDateFilter.startAt.$lt = endDateTime;
      }
    }

    // Total slots (not date dependent)
    const totalSlots = await ParkingSlot.countDocuments();
    const availableSlots = await ParkingSlot.countDocuments({ status: 'Available' });
    const occupiedSlots = await ParkingSlot.countDocuments({ status: 'Occupied' });
    
    // Active reservations with date filter
    const now = new Date();
    const activeReservationsFilter = {
      status: 'Active',
      endAt: { $gt: now },
      ...reservationDateFilter
    };
    const activeReservations = await Reservation.countDocuments(activeReservationsFilter);
    
    // Total reservations with date filter
    const totalReservations = await Reservation.countDocuments(reservationDateFilter);
    
    // Total payments with date filter
    const totalPayments = await Payment.countDocuments(dateFilter);
    
    // Total users (not date dependent)
    const totalUsers = await User.countDocuments({ role: 'driver' });
    
    // Revenue with date filter
    const revenueFilter = dateFilter.createdAt ? [
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ] : [
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ];
    
    const revenueResult = await Payment.aggregate(revenueFilter);

    // Slot utilization with date filter
    const slotUtilization = await Reservation.aggregate([
      { $match: reservationDateFilter },
      {
        $group: {
          _id: '$slot',
          reservationCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'parkingslots',
          localField: '_id',
          foreignField: '_id',
          as: 'slotInfo'
        }
      },
      { $unwind: '$slotInfo' },
      {
        $project: {
          slotNumber: '$slotInfo.slotNumber',
          reservationCount: 1
        }
      },
      { $sort: { reservationCount: -1 } },
      { $limit: 10 }
    ]);

    // Recent reservations with date filter
    const recentReservations = await Reservation.find(reservationDateFilter)
      .populate('slot', 'slotNumber')
      .populate('vehicle', 'number')
      .populate('user', 'name email')
      .sort({ startAt: -1 })
      .limit(20);

    res.json({
      totalSlots,
      availableSlots,
      occupiedSlots,
      activeReservations,
      totalReservations,
      totalPayments,
      totalRevenue: revenueResult[0]?.total || 0,
      totalUsers,
      slotUtilization,
      recentReservations,
    });
  } catch (err) {
    next(err);
  }
};

// Validate ticket/reservation
exports.validateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format before querying
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('Invalid ObjectId format:', id);
      return res.status(400).json({ 
        error: 'Invalid reservation ID format',
        details: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    
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
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        dateFilter.createdAt.$lt = endDateTime;
      }
    }

    const payments = await Payment.find(dateFilter)
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
    const { startDate, endDate } = req.query;
    const now = new Date();
    
    // First, update any expired reservations to Completed status
    await Reservation.updateMany(
      { 
        status: 'Active',
        endAt: { $lt: now }
      },
      { 
        $set: { status: 'Completed' }
      }
    );
    
    // Build date filter for reservations
    let reservationDateFilter = {
      status: 'Active',
      endAt: { $gt: now } // Only show reservations where end time is in the future
    };
    
    if (startDate || endDate) {
      reservationDateFilter.startAt = {};
      if (startDate) {
        reservationDateFilter.startAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        reservationDateFilter.startAt.$lt = endDateTime;
      }
    }
    
    // Then fetch only truly active reservations
    const reservations = await Reservation.find(reservationDateFilter)
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
