const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/auth');          // user/driver auth
const driverRoutes = require('./routes/driver');      // driver functions
const adminRoutes = require('./routes/admin');        // protected admin routes
const adminAuthRoutes = require('./routes/adminAuth'); // admin signup/login

const app = express();

// CORS configuration - allow all origins (Vercel URLs change frequently)
const corsOptions = {
  origin: function (origin, callback) {
    // Postman / curl / mobile apps
    if (!origin) return callback(null, true);

    // ✅ Allow any origin (Vercel frontend URL change ho sakta hai)
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

// 👉 Sabse upar - CORS middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
