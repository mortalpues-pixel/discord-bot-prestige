const mongoose = require('mongoose');
const User = require('./models/User');
const Mission = require('./models/Mission');
const Submission = require('./models/Submission');
const Event = require('./models/Event');
const Counter = require('./models/Counter');

// Initialize DB
async function initDb() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('ERROR: MONGODB_URI not found in .env');
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB!');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

// Helper: Get Next Sequence
async function getNextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { new: true, upsert: true } // Upsert creates it if it doesn't exist
    );
    return counter.seq;
}

// User Helpers
const getUserPrestige = async (userId) => {
    const user = await User.findOne({ userId });
    return user ? user.prestige : 0;
};

const addUserPrestige = async (userId, amount) => {
    const user = await User.findOneAndUpdate(
        { userId },
        { $inc: { prestige: amount } },
        { new: true, upsert: true }
    );
    return user.prestige;
};

const resetUserPrestige = async (userId) => {
    await User.findOneAndUpdate(
        { userId },
        { prestige: 0 },
        { upsert: true }
    );
};

// Mission Helpers
const setActiveMission = async (missionKey, description = null, reward = null) => {
    await Mission.findOneAndUpdate(
        { id: 1 },
        {
            mission_key: missionKey,
            description: description,
            reward: reward,
            is_custom: !!description,
            date_set: new Date()
        },
        { upsert: true, new: true }
    );
};

const getActiveMission = async () => {
    const mission = await Mission.findOne({ id: 1 });
    return mission ? mission.toObject() : null;
};

// Submission Helpers
const addSubmission = async (userId, missionKey, proofContent, rewardSnapshot = 0) => {
    const nextId = await getNextSequence('submission_id');
    const submission = new Submission({
        id: nextId,
        user_id: userId,
        mission_key: missionKey,
        proof_content: proofContent,
        reward_snapshot: rewardSnapshot,
        status: 'pending'
    });
    const saved = await submission.save();
    return saved.id;
};

const getPendingSubmissions = async () => {
    return await Submission.find({ status: 'pending' });
};

const updateSubmissionStatus = async (submissionId, status) => {
    await Submission.findOneAndUpdate({ id: submissionId }, { status });
};

const getSubmission = async (submissionId) => {
    // submissionId passed from slash command is integer
    return await Submission.findOne({ id: submissionId });
};

// Event Helpers
const createEvent = async (title, description, dateTime, createdBy, reward = 0) => {
    const nextId = await getNextSequence('event_id');
    const event = new Event({
        id: nextId,
        title,
        description,
        date_time: dateTime,
        created_by: createdBy,
        reward,
        status: 'open',
        attendees: []
    });
    const saved = await event.save();
    return { lastInsertRowid: saved.id };
};

const getEvents = async () => {
    return await Event.find().sort({ id: -1 }).limit(10);
};

const getEvent = async (eventId) => {
    return await Event.findOne({ id: eventId });
};

const updateEventStatus = async (eventId, status) => {
    const res = await Event.findOneAndUpdate({ id: eventId }, { status });
    return !!res;
};

const registerForEvent = async (eventId, userId) => {
    const event = await Event.findOne({ id: eventId });
    if (!event) return false;

    // Check if already registered
    if (event.attendees.includes(userId)) return false;

    event.attendees.push(userId);
    await event.save();
    return true;
};

const getEventAttendees = async (eventId) => {
    const event = await Event.findOne({ id: eventId });
    return event ? event.attendees : [];
};

module.exports = {
    initDb,
    addUserPrestige,
    getUserPrestige,
    resetUserPrestige,
    setActiveMission,
    getActiveMission,
    addSubmission,
    getPendingSubmissions,
    updateSubmissionStatus,
    getSubmission,
    createEvent,
    getEvents,
    getEvent,
    updateEventStatus,
    registerForEvent,
    getEventAttendees
};
