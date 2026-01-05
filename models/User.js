const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    prestige: { type: Number, default: 0 },
    weekly_prestige: { type: Number, default: 0 },
    last_weekly_reset: { type: Date, default: Date.now },
    warnings: [{
        reason: { type: String, required: true },
        moderator: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('User', userSchema);
