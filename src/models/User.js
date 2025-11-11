const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['driver', 'admin'], default: 'driver' },
});

module.exports = mongoose.model('User', userSchema);
