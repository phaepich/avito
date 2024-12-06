const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  currentBatch: { type: Number, default: 1 }, // Текущий номер партии
});

module.exports = mongoose.model('Batch', batchSchema);
