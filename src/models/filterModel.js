const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const Filter = mongoose.model('Filter', filterSchema);

module.exports = Filter;
