const mongoose = require('mongoose');

const prestigeLogSchema = new mongoose.Schema({
    targetUserId: { type: String, required: true },
    adminId: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrestigeLog', prestigeLogSchema);
