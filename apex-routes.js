// APEX Scheduler Routes
// Data persistence for the APEX life OS app

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Password protection middleware - disabled for now
const requireAuth = (req, res, next) => {
  // Auth disabled - allow all requests
  next();
};

// MongoDB Schemas
const ApexSettingsSchema = new mongoose.Schema({
  shifts: { type: Array, default: Array(7).fill("none") },
  prefs: { 
    type: Object, 
    default: { morningDur: 2, workoutDur: 1, deepWorkH: 3, workoutAM: true }
  },
  theme: { type: String, default: 'dark' },
  botToken: { type: String, default: '' },
  chatId: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const ApexScheduleSchema = new mongoose.Schema({
  weekKey: { type: String, required: true },
  schedule: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ApexTaskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  note: { type: String, default: '' },
  priority: { type: String, default: 'medium' },
  day: { type: String, default: 'any' },
  category: { type: String, default: 'techWork' },
  done: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

const ApexHabitSchema = new mongoose.Schema({
  key: { type: String, required: true }, // Format: WK-di-hid
  weekKey: { type: String, required: true },
  dayIndex: { type: Number, required: true },
  habitId: { type: String, required: true },
  completed: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ApexReflectionSchema = new mongoose.Schema({
  weekKey: { type: String, required: true },
  index: { type: Number, required: true },
  value: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const ApexGamificationSchema = new mongoose.Schema({
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dailyScores: { type: Object, default: {} },
  achievements: { type: Array, default: [] },
  moodLog: { type: Object, default: {} },
  notes: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
});

// Models
const ApexSettings = mongoose.model('ApexSettings', ApexSettingsSchema);
const ApexSchedule = mongoose.model('ApexSchedule', ApexScheduleSchema);
const ApexTask = mongoose.model('ApexTask', ApexTaskSchema);
const ApexHabit = mongoose.model('ApexHabit', ApexHabitSchema);
const ApexReflection = mongoose.model('ApexReflection', ApexReflectionSchema);
const ApexGamification = mongoose.model('ApexGamification', ApexGamificationSchema);

// Routes

// Auth check - disabled for now, auto-accept
router.post('/auth', (req, res) => {
  res.json({ success: true, token: 'no-password-required' });
});

// Verify token - disabled, always valid
router.get('/verify', (req, res) => {
  res.json({ valid: true });
});

// Get all data (bulk fetch for app init)
router.get('/data', requireAuth, async (req, res) => {
  try {
    const settings = await ApexSettings.findOne().sort({ updatedAt: -1 }) || {};
    const schedules = await ApexSchedule.find().sort({ createdAt: -1 }).limit(1);
    const tasks = await ApexTask.find().sort({ createdAt: -1 });
    const habits = await ApexHabit.find();
    const reflections = await ApexReflection.find();
    const gamification = await ApexGamification.findOne().sort({ updatedAt: -1 }) || {};

    // Convert habits array to object format
    const habitsObj = {};
    habits.forEach(h => {
      habitsObj[h.key] = true;
    });

    // Convert reflections array to object format
    const reflectionsObj = {};
    reflections.forEach(r => {
      if (!reflectionsObj[r.weekKey]) reflectionsObj[r.weekKey] = {};
      reflectionsObj[r.weekKey][r.index] = r.value;
    });

    res.json({
      settings,
      schedule: schedules[0] || null,
      tasks,
      habits: habitsObj,
      reflections: reflectionsObj,
      gamification
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await ApexSettings.findOne().sort({ updatedAt: -1 });
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', requireAuth, async (req, res) => {
  try {
    const { shifts, prefs, theme, botToken, chatId } = req.body;
    const settings = await ApexSettings.findOneAndUpdate(
      {},
      { shifts, prefs, theme, botToken, chatId, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { weekKey, schedule } = req.body;
    const saved = await ApexSchedule.findOneAndUpdate(
      { weekKey },
      { weekKey, schedule, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tasks
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await ApexTask.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const taskData = req.body;
    const task = new ApexTask(taskData);
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await ApexTask.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, completedAt: req.body.done ? Date.now() : null },
      { new: true }
    );
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    await ApexTask.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habits
router.post('/habits', requireAuth, async (req, res) => {
  try {
    const { key, weekKey, dayIndex, habitId, completed } = req.body;
    const habit = await ApexHabit.findOneAndUpdate(
      { key },
      { key, weekKey, dayIndex, habitId, completed, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(habit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reflections
router.post('/reflections', requireAuth, async (req, res) => {
  try {
    const { weekKey, index, value } = req.body;
    const reflection = await ApexReflection.findOneAndUpdate(
      { weekKey, index },
      { weekKey, index, value, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(reflection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gamification
router.get('/gamification', requireAuth, async (req, res) => {
  try {
    const data = await ApexGamification.findOne().sort({ updatedAt: -1 });
    res.json(data || { xp: 0, level: 1, dailyScores: {}, achievements: [], moodLog: {}, notes: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/gamification', requireAuth, async (req, res) => {
  try {
    const { xp, level, dailyScores, achievements, moodLog, notes } = req.body;
    const data = await ApexGamification.findOneAndUpdate(
      {},
      { xp, level, dailyScores, achievements, moodLog, notes, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Telegram bot webhook
router.post('/telegram-webhook', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.text) {
      return res.json({ ok: true });
    }
    
    // Store chatId if first message
    if (message.chat && message.chat.id) {
      await ApexSettings.findOneAndUpdate(
        {},
        { chatId: String(message.chat.id) },
        { upsert: true }
      );
    }
    
    // Return success - actual command handling happens in frontend polling
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat ID for notifications
router.get('/chat-id', requireAuth, async (req, res) => {
  try {
    const settings = await ApexSettings.findOne();
    res.json({ chatId: settings?.chatId || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, ApexSettings };
