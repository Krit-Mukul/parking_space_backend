const Reservation = require('../models/Reservation');
const ParkingSlot = require('../models/ParkingSlot');

/**
 * Update parking slot statuses based on active reservations
 * This should be called periodically to keep slot statuses in sync
 */
async function updateSlotStatuses() {
  try {
    const now = new Date();

    // Find all reservations that have ended
    const endedReservations = await Reservation.find({
      status: 'Active',
      endAt: { $lt: now }
    });

    // Mark ended reservations as completed
    for (const reservation of endedReservations) {
      reservation.status = 'Completed';
      await reservation.save();

      // Free up the slot if no other active reservations
      if (reservation.slot) {
        const hasOtherActiveReservations = await Reservation.findOne({
          slot: reservation.slot,
          status: 'Active',
          startAt: { $lte: now },
          endAt: { $gte: now }
        });

        if (!hasOtherActiveReservations) {
          const slot = await ParkingSlot.findById(reservation.slot);
          if (slot) {
            // Check if there's an upcoming reservation
            const upcomingReservation = await Reservation.findOne({
              slot: slot._id,
              status: 'Active',
              startAt: { $gt: now }
            });

            if (upcomingReservation) {
              slot.status = 'Reserved';
            } else {
              slot.status = 'Available';
            }
            await slot.save();
          }
        }
      }
    }

    // Find reservations that should start now
    const startingReservations = await Reservation.find({
      status: 'Active',
      startAt: { $lte: now },
      endAt: { $gte: now }
    });

    // Mark their slots as occupied
    for (const reservation of startingReservations) {
      if (reservation.slot) {
        const slot = await ParkingSlot.findById(reservation.slot);
        if (slot && slot.status !== 'Occupied') {
          slot.status = 'Occupied';
          await slot.save();
        }
      }
    }

    console.log(`Slot status update completed at ${now.toISOString()}`);
  } catch (error) {
    console.error('Error updating slot statuses:', error);
  }
}

/**
 * Start the scheduler to run every minute
 */
function startSlotScheduler() {
  // Run immediately on startup
  updateSlotStatuses();

  // Then run every minute
  setInterval(updateSlotStatuses, 60 * 1000); // 60 seconds

  console.log('Slot scheduler started - running every minute');
}

module.exports = { updateSlotStatuses, startSlotScheduler };
