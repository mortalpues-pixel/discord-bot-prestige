const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    date_time: { type: String, required: true },
    created_by: { type: String, required: true },
    reward: { type: Number, default: 0 },
    status: { type: String, default: 'open', enum: ['open', 'closed', 'finished'] },
    attendees: [{ type: String }] // Array of User IDs
});

module.exports = mongoose.model('Event', eventSchema);
