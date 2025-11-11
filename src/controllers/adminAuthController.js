const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerSchema, loginSchema } = require('../validators/authValidator');

// ✅ Admin Signup
exports.registerAdmin = async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: parsed.email });
    if (existing) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const admin = await User.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: 'admin', // ✅ force admin role
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      id: admin._id,
      email: admin.email,
    });
  } catch (err) {
    next(err);
  }
};

// ✅ Admin Login
exports.loginAdmin = async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    const admin = await User.findOne({ email: parsed.email, role: 'admin' });
    if (!admin) {
      return res.status(400).json({ error: 'Admin not found or invalid credentials' });
    }

    const valid = await bcrypt.compare(parsed.password, admin.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      role: admin.role,
    });
  } catch (err) {
    next(err);
  }
};
