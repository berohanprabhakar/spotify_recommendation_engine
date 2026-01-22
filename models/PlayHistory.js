const mongoose = require('mongoose');

const PlayHistorySchema = new mongoose.Schema({
  trackId: String,
  playedAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 // 30 days in seconds
  },
});

module.exports = mongoose.model('PlayHistory', PlayHistorySchema);
