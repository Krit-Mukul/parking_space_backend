const { z } = require('zod');

exports.registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least 1 special character')
    .regex(/[a-zA-Z]/, 'Password must contain at least 1 letter'),
});

exports.loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
