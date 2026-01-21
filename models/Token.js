// models/Token.js
const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  refreshToken: String,
});

module.exports = mongoose.model('Token', TokenSchema);
