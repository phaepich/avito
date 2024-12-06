const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: String,
  url: String,
  price: String,
  location: String,
  date: String,
  imageUrl: String,
  isRead: { type: Boolean, default: false }, // Отметка прочитанности
  batch: { type: Number, default: 1 }, // Номер партии, по умолчанию первая
});

module.exports = mongoose.model('Ad', adSchema);
