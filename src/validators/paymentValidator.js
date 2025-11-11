const { z } = require('zod');

exports.paymentSchema = z.object({
  reservationId: z.string(),
  amount: z.number().positive(),
  method: z.string().min(2),
});
