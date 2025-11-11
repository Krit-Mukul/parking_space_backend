const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/auth');          // user/driver auth
const driverRoutes = require('./routes/driver');      // driver functions
const adminRoutes = require('./routes/admin');        // protected admin routes
const adminAuthRoutes = require('./routes/adminAuth'); // admin signup/login

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check route
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ✅ Public routes (no JWT required)
app.use('/api/auth', authRoutes);            // driver login/signup
app.use('/api/admin/auth', adminAuthRoutes); // admin signup/login

// ✅ Protected routes (require JWT)
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
