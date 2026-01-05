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

// Helper: Check Weekly Reset
const checkWeeklyReset = async (user) => {
    const now = new Date();
    const lastReset = user.last_weekly_reset || new Date(0);

    // Get ISO week number for comparison
    const getISOWeek = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    const currentWeek = getISOWeek(now);
    const lastResetWeek = getISOWeek(lastReset);
    const currentYear = now.getUTCFullYear();
    const lastResetYear = lastReset.getUTCFullYear();

    if (currentWeek !== lastResetWeek || currentYear !== lastResetYear) {
        user.weekly_prestige = 0;
        user.last_weekly_reset = now;
        return true;
    }
    return false;
};

// User Helpers
const getUserPrestige = async (userId) => {
    const user = await User.findOne({ userId });
    if (!user) return 0;

    // Check reset on read to ensure accuracy
    const changed = await checkWeeklyReset(user);
    if (changed) await user.save();

    return user.prestige;
};

const getUserData = async (userId) => {
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({ userId });
        await user.save();
    } else {
        const changed = await checkWeeklyReset(user);
        if (changed) await user.save();
    }
    return user.toObject();
};

const addUserPrestige = async (userId, amount) => {
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({ userId });
    }

    await checkWeeklyReset(user);

    user.prestige += amount;
    user.weekly_prestige += amount;

    await user.save();
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
    if (!mission) return null;

    const now = new Date();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (now - mission.date_set > expirationTime) {
        // The mission has expired
        return null;
    }

    return mission.toObject();
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

// Start Warnings
const addWarning = async (userId, reason, moderatorTag) => {
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({ userId });
    }

    user.warnings.push({
        reason,
        moderator: moderatorTag,
        date: new Date()
    });

    await user.save();
    return user.warnings.length;
};

const getWarnings = async (userId) => {
    const user = await User.findOne({ userId });
    return user ? user.warnings : [];
};
// End Warnings

// Weekly Leaderboard
const getWeeklyLeaderboard = async () => {
    // 1. Fetch all users to check resets
    // Note: For very large databases this should be batched or handled differently,
    // but for a discord bot < 10k users it's acceptable for now.
    const users = await User.find({});

    const validUsers = [];

    for (const user of users) {
        const changed = await checkWeeklyReset(user);
        if (changed) await user.save();

        if (user.weekly_prestige > 0) {
            validUsers.push(user);
        }
    }

    // 2. Sort by weekly_prestige desc
    validUsers.sort((a, b) => b.weekly_prestige - a.weekly_prestige);

    return validUsers.slice(0, 10);
};

module.exports = {
    initDb,
    addUserPrestige,
    getUserPrestige,
    getUserData,
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
    getEventAttendees,
    addWarning,
    getWarnings,
    getWeeklyLeaderboard
};
