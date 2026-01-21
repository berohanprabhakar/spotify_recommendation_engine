const mongoose = require('mongoose');

const PlayHistorySchema = new mongoose.Schema({
  trackId: String,
  playedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PlayHistory', PlayHistorySchema);
