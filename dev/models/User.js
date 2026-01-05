const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String, // Di produksi harus di-hash (bcrypt), tapi untuk belajar kita plain dulu
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  rewardsHistory: [
    {
      itemName: String,
      cost: Number,
      date: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('User', UserSchema);