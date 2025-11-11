const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
  slotNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Available', 'Reserved', 'Occupied'], default: 'Available' },
});

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
