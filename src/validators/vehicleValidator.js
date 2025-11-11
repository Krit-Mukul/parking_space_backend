const { z } = require('zod');

exports.vehicleSchema = z.object({
  number: z.string().min(3),
  model: z.string().optional(),
});
