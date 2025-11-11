const mongoose = require('mongoose');
const ParkingSlot = require('../models/ParkingSlot');
require('dotenv').config();

const seedSlots = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/parking-system');
    console.log('Connected to MongoDB');

    // Clear existing slots
    await ParkingSlot.deleteMany({});
    console.log('Cleared existing slots');

    // Create parking slots with different statuses
    const slots = [
      // Row A - Mostly Available (A1-A10)
      { slotNumber: 'A1', status: 'Available' },
      { slotNumber: 'A2', status: 'Available' },
      { slotNumber: 'A3', status: 'Occupied' },
      { slotNumber: 'A4', status: 'Available' },
      { slotNumber: 'A5', status: 'Available' },
      { slotNumber: 'A6', status: 'Available' },
      { slotNumber: 'A7', status: 'Occupied' },
      { slotNumber: 'A8', status: 'Available' },
      { slotNumber: 'A9', status: 'Available' },
      { slotNumber: 'A10', status: 'Available' },

      // Row B - Mixed (B1-B8)
      { slotNumber: 'B1', status: 'Available' },
      { slotNumber: 'B2', status: 'Occupied' },
      { slotNumber: 'B3', status: 'Available' },
      { slotNumber: 'B4', status: 'Available' },
      { slotNumber: 'B5', status: 'Occupied' },
      { slotNumber: 'B6', status: 'Available' },
      { slotNumber: 'B7', status: 'Available' },
      { slotNumber: 'B8', status: 'Occupied' },

      // Row C - Some Reserved (C1-C5)
      { slotNumber: 'C1', status: 'Available' },
      { slotNumber: 'C2', status: 'Reserved' },
      { slotNumber: 'C3', status: 'Available' },
      { slotNumber: 'C4', status: 'Reserved' },
      { slotNumber: 'C5', status: 'Available' },

      // Row D - Mix of available and occupied (D1-D7)
      { slotNumber: 'D1', status: 'Available' },
      { slotNumber: 'D2', status: 'Occupied' },
      { slotNumber: 'D3', status: 'Available' },
      { slotNumber: 'D4', status: 'Available' },
      { slotNumber: 'D5', status: 'Occupied' },
      { slotNumber: 'D6', status: 'Available' },
      { slotNumber: 'D7', status: 'Available' },
    ];

    // Insert all slots
    const createdSlots = await ParkingSlot.insertMany(slots);
    console.log(`✓ Successfully created ${createdSlots.length} parking slots`);

    // Show summary
    const available = createdSlots.filter(s => s.status === 'Available').length;
    const occupied = createdSlots.filter(s => s.status === 'Occupied').length;
    const reserved = createdSlots.filter(s => s.status === 'Reserved').length;

    console.log('\nSlot Summary:');
    console.log(`  Available: ${available} slots`);
    console.log(`  Occupied: ${occupied} slots`);
    console.log(`  Reserved: ${reserved} slots`);
    console.log(`  Total: ${createdSlots.length} slots`);

    console.log('\nSlot Details:');
    console.log('Available slots:', createdSlots.filter(s => s.status === 'Available').map(s => s.slotNumber).join(', '));
    console.log('Occupied slots:', createdSlots.filter(s => s.status === 'Occupied').map(s => s.slotNumber).join(', '));
    console.log('Reserved slots:', createdSlots.filter(s => s.status === 'Reserved').map(s => s.slotNumber).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('Error seeding slots:', error);
    process.exit(1);
  }
};

seedSlots();
