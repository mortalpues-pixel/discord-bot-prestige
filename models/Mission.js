const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
    id: { type: Number, required: true }, // Keeping ID for compatibility, though _id exists
    mission_key: { type: String, required: true },
    description: { type: String },
    reward: { type: String },
    is_custom: { type: Boolean, default: false },
    date_set: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mission', missionSchema);
