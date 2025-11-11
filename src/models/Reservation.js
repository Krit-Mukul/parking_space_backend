const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  slot: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSlot' },
  startAt: { type: Date, required: true },
  endAt: { type: Date },
  duration: { type: Number }, // Duration in hours
  totalAmount: { type: Number, default: 0 }, // Total cost
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  status: { type: String, enum: ['Active', 'Completed', 'Cancelled'], default: 'Active' },
});

module.exports = mongoose.model('Reservation', reservationSchema);
