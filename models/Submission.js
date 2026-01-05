const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    user_id: { type: String, required: true },
    mission_key: { type: String, required: true },
    proof_content: { type: mongoose.Schema.Types.Mixed }, // String or Array
    reward_snapshot: { type: Number, default: 0 },
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', submissionSchema);
