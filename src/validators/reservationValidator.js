const { z } = require('zod');

exports.reservationSchema = z.object({
  vehicleId: z.string(),
  slotId: z.string().optional(),
  slotNumber: z.string().optional(),
  startAt: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }),
  duration: z.number().optional(),
});
