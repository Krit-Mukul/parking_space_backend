const { z } = require('zod');

exports.vehicleSchema = z.object({
  number: z.string()
    .regex(
      /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,
      "Vehicle number must be in format AA00A0000 or AA00AA0000 (e.g., MH12AB1234 or DL01A1234)"
    ),
  model: z.string().optional(),
});
