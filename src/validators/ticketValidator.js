const { z } = require('zod');

const validateTicketSchema = z.object({
  ticketId: z.string().min(1)
});

module.exports = { validateTicketSchema };
