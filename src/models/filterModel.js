const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }, // Активен ли фильтр
});

module.exports = mongoose.model('Filter', filterSchema);
