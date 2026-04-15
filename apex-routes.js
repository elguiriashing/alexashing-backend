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

// Habit document keys from the client look like: "2026-W15-0-workout" → weekKey, dayIndex, habitId
function parseHabitStorageKey(key) {
  const m = String(key).match(/^(\d{4}-W\d{2})-(\d+)-(.+)$/);
  if (!m) return null;
  return { weekKey: m[1], dayIndex: parseInt(m[2], 10), habitId: m[3] };
}

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
      habitsObj[h.key] = h.completed !== false;
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

// Save all data (bulk save)
router.post('/data', requireAuth, async (req, res) => {
  try {
    const { settings, schedule, tasks, habits, reflections, gamification } = req.body;

    // Save settings
    if (settings) {
      await ApexSettings.findOneAndUpdate(
        {},
        { ...settings, updatedAt: Date.now() },
        { upsert: true, new: true }
      );
    }

    // Save schedule
    if (schedule) {
      await ApexSchedule.findOneAndUpdate(
        { weekKey: schedule.weekKey },
        { schedule: schedule.schedule, updatedAt: Date.now() },
        { upsert: true, new: true }
      );
    }

    // Save tasks - replace all
    if (tasks && Array.isArray(tasks)) {
      await ApexTask.deleteMany({});
      if (tasks.length > 0) {
        await ApexTask.insertMany(tasks.map((t) => ({
          id: t.id,
          text: t.text,
          note: t.note || '',
          priority: t.priority || 'medium',
          day: t.day || 'any',
          category: t.category || 'techWork',
          done: !!t.done,
          createdAt: t.createdAt || t.created || Date.now(),
          completedAt: t.done ? (t.completedAt || Date.now()) : null,
        })));
      }
    }

    // Save habits - replace all
    if (habits && typeof habits === 'object') {
      await ApexHabit.deleteMany({});
      const habitEntries = Object.entries(habits)
        .filter(([, value]) => value === true)
        .map(([key]) => {
          const parsed = parseHabitStorageKey(key);
          if (!parsed) return null;
          return {
            key,
            weekKey: parsed.weekKey,
            dayIndex: parsed.dayIndex,
            habitId: parsed.habitId,
            completed: true,
            createdAt: Date.now(),
          };
        })
        .filter(Boolean);
      if (habitEntries.length > 0) {
        await ApexHabit.insertMany(habitEntries);
      }
    }

    // Save reflections - replace all
    if (reflections && typeof reflections === 'object') {
      await ApexReflection.deleteMany({});
      const reflectionEntries = [];
      Object.entries(reflections).forEach(([weekKey, weekReflections]) => {
        Object.entries(weekReflections).forEach(([index, value]) => {
          if (value) {
            reflectionEntries.push({ weekKey, index, value, updatedAt: Date.now() });
          }
        });
      });
      if (reflectionEntries.length > 0) {
        await ApexReflection.insertMany(reflectionEntries);
      }
    }

    // Save gamification
    if (gamification) {
      await ApexGamification.findOneAndUpdate(
        {},
        { ...gamification, updatedAt: Date.now() },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Data saved' });
  } catch (error) {
    console.error('Bulk save error:', error);
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
    if (completed === false) {
      await ApexHabit.deleteOne({ key });
      return res.json({ success: true, key, completed: false });
    }
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

// Telegram HTTP proxy (browser cannot call api.telegram.org — no CORS)
router.post('/telegram/sendMessage', requireAuth, async (req, res) => {
  try {
    const { token, chat_id, text, parse_mode } = req.body;
    if (!token || chat_id == null || text == null) {
      return res.status(400).json({ ok: false, error: 'token, chat_id, and text are required' });
    }
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode: parse_mode || 'Markdown',
      }),
    });
    const data = await r.json().catch(() => ({ ok: false, description: 'Invalid JSON from Telegram' }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/telegram/getUpdates', requireAuth, async (req, res) => {
  try {
    const { token, offset, limit } = req.body;
    if (!token) {
      return res.status(400).json({ ok: false, error: 'token is required' });
    }
    const qs = new URLSearchParams({
      offset: String(offset ?? 0),
      limit: String(limit ?? 10),
    });
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${qs}`);
    const data = await r.json().catch(() => ({ ok: false, description: 'Invalid JSON from Telegram' }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Helper: Send Telegram message
async function sendTelegramMessage(token, chatId, text, parse_mode = 'Markdown') {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode }),
    });
    return await r.json();
  } catch (error) {
    console.error('Telegram send error:', error);
    return { ok: false, error: error.message };
  }
}

// Helper: Get today's day name
function getTodayDayName() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
}

// Helper: Get current week key
function getCurrentWeekKey() {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.floor((now - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Helper: Find next activity from schedule
async function getNextActivity() {
  try {
    const schedule = await ApexSchedule.findOne().sort({ createdAt: -1 });
    if (!schedule || !schedule.schedule) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const dayIndex = now.getDay(); // 0-6
    
    // Get today's schedule
    const todaySchedule = schedule.schedule[dayIndex];
    if (!todaySchedule) return null;
    
    // Find next activity
    for (const block of todaySchedule) {
      if (!block || block.activity === 'sleep') continue;
      
      const [startHour, startMin] = block.start.split(':').map(Number);
      const blockTime = startHour * 60 + startMin;
      const currentTime = currentHour * 60 + currentMin;
      
      // If activity starts in the future (more than 10 mins from now)
      if (blockTime > currentTime + 10) {
        return {
          activity: block.activity,
          start: block.start,
          end: block.end,
          minutesUntil: blockTime - currentTime
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting next activity:', error);
    return null;
  }
}

// Track sent reminders to avoid duplicates
const sentReminders = new Set();
const sentMorningBriefs = new Set();

// Helper: Get shift info for today
async function getTodayShift(settings) {
  if (!settings?.shifts) return null;
  const dayIndex = new Date().getDay();
  const shiftType = settings.shifts[dayIndex];
  if (!shiftType || shiftType === 'none') return null;
  
  // Shift times based on shift type
  const shiftTimes = {
    'early': { start: '06:00', name: 'Early Shift' },
    'day': { start: '09:00', name: 'Day Shift' },
    'late': { start: '14:00', name: 'Late Shift' },
    'night': { start: '22:00', name: 'Night Shift' }
  };
  
  return shiftTimes[shiftType] || null;
}

// Helper: Send morning brief
async function sendMorningBrief(settings) {
  const chatId = settings.chatId;
  const token = settings.botToken;
  
  // Get today's schedule
  const schedule = await ApexSchedule.findOne().sort({ createdAt: -1 });
  const dayIndex = new Date().getDay();
  const todaySchedule = schedule?.schedule?.[dayIndex] || [];
  
  // Get pending tasks
  const pendingTasks = await ApexTask.find({ done: false }).sort({ priority: -1 }).limit(5);
  
  // Get shift info
  const shift = await getTodayShift(settings);
  
  // Build brief
  let text = `🌅 *Good Morning! Here's your daily brief:*\n\n`;
  
  // Schedule
  text += `📅 *Today's Schedule:*\n`;
  if (todaySchedule.length > 0) {
    todaySchedule.forEach(block => {
      if (!block) return;
      const emoji = { sleep: '😴', work: '💼', workout: '💪', learn: '📚', rest: '☕', meal: '🍽️' }[block.activity] || '⏰';
      text += `${emoji} ${block.start}-${block.end}: ${block.activity.toUpperCase()}\n`;
    });
  } else {
    text += `No schedule set for today\n`;
  }
  
  // Shift reminder
  if (shift) {
    text += `\n💼 *Shift Today:* ${shift.name} at ${shift.start}\n`;
  }
  
  // Tasks
  text += `\n📝 *Top Tasks:*\n`;
  if (pendingTasks.length > 0) {
    pendingTasks.forEach((task, i) => {
      const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      text += `${i + 1}. ${priority} ${task.text}\n`;
    });
    const moreTasks = await ApexTask.countDocuments({ done: false }) - pendingTasks.length;
    if (moreTasks > 0) {
      text += `_...and ${moreTasks} more_\n`;
    }
  } else {
    text += `🎉 No pending tasks!\n`;
  }
  
  // Habits
  const weekKey = getCurrentWeekKey();
  const habitsToday = await ApexHabit.countDocuments({ weekKey, dayIndex });
  text += `\n🎯 *Habits today:* ${habitsToday} tracked\n`;
  
  text += `\n💪 *Have a productive day!* 🚀`;
  
  await sendTelegramMessage(token, chatId, text, 'Markdown');
}

// Scheduled reminder checker (runs every minute)
let reminderInterval = null;
function startReminderScheduler() {
  if (reminderInterval) clearInterval(reminderInterval);
  
  reminderInterval = setInterval(async () => {
    const settings = await ApexSettings.findOne();
    if (!settings?.botToken || !settings?.chatId) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    
    // 1. Activity reminders - every hour at :50 (10 mins before)
    if (currentMin === 50) {
      const nextActivity = await getNextActivity();
      if (nextActivity && nextActivity.minutesUntil <= 10 && nextActivity.activity !== 'sleep') {
        const emoji = { work: '💼', workout: '💪', learn: '📚', rest: '☕', meal: '🍽️' }[nextActivity.activity] || '⏰';
        await sendTelegramMessage(
          settings.botToken,
          settings.chatId,
          `${emoji} *Up next in 10 minutes:*\n\n${nextActivity.activity.toUpperCase()}\n⏰ ${nextActivity.start} - ${nextActivity.end}`,
          'Markdown'
        );
      }
    }
    
    // 2. Shift reminders - 30 mins before shift starts
    const shift = await getTodayShift(settings);
    if (shift) {
      const [shiftHour, shiftMin] = shift.start.split(':').map(Number);
      const shiftTime = shiftHour * 60 + shiftMin;
      const minsToShift = shiftTime - currentTime;
      const reminderKey = `shift-${todayKey}`;
      
      // Send reminder exactly 30 mins before
      if (minsToShift === 30 && !sentReminders.has(reminderKey)) {
        await sendTelegramMessage(
          settings.botToken,
          settings.chatId,
          `💼 *Shift Reminder*\n\nYour ${shift.name} starts in 30 minutes!\n⏰ Start time: ${shift.start}\n\nGet ready! 🚀`,
          'Markdown'
        );
        sentReminders.add(reminderKey);
      }
    }
    
    // 3. Morning brief - when sleep ends (first non-sleep activity or 8 AM)
    const briefKey = `brief-${todayKey}`;
    if (!sentMorningBriefs.has(briefKey)) {
      const schedule = await ApexSchedule.findOne().sort({ createdAt: -1 });
      const todaySchedule = schedule?.schedule?.[dayIndex] || [];
      
      // Find when sleep ends (first non-sleep activity or default 8 AM)
      let wakeUpTime = 8 * 60; // Default 8:00 AM
      for (const block of todaySchedule) {
        if (block && block.activity !== 'sleep') {
          const [hour, min] = block.start.split(':').map(Number);
          wakeUpTime = hour * 60 + min;
          break;
        }
      }
      
      // Send brief at wake up time or 8 AM (whichever is later, but before 10 AM)
      if (currentTime === Math.min(wakeUpTime, 10 * 60) && currentHour >= 6) {
        await sendMorningBrief(settings);
        sentMorningBriefs.add(briefKey);
      }
    }
    
    // Cleanup old reminders at midnight
    if (currentHour === 0 && currentMin === 0) {
      sentReminders.clear();
      sentMorningBriefs.clear();
    }
    
  }, 60000); // Check every minute
}

// Start the scheduler when module loads
startReminderScheduler();

// Telegram command handlers
const telegramCommands = {
  async tasks(args, settings) {
    const tasks = await ApexTask.find({ done: false }).sort({ createdAt: -1 }).limit(10);
    if (tasks.length === 0) {
      return '🎉 No pending tasks! Great job!';
    }
    
    let text = '📝 *Your Pending Tasks:*\n\n';
    tasks.forEach((task, i) => {
      const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      text += `${i + 1}. ${priority} ${task.text}\n   \`/done ${task.id}\`\n\n`;
    });
    text += `\nTotal: ${tasks.length} tasks pending`;
    return text;
  },
  
  async done(args, settings) {
    const taskId = args[0];
    if (!taskId) return '❌ Usage: `/done <task-id>`';
    
    const task = await ApexTask.findOneAndUpdate(
      { id: taskId },
      { done: true, completedAt: new Date() },
      { new: true }
    );
    
    if (!task) return '❌ Task not found';
    return `✅ Completed: *${task.text}*`;
  },
  
  async add(args, settings) {
    const text = args.join(' ');
    if (!text) return '❌ Usage: `/add <task description>`';
    
    const task = new ApexTask({
      id: `task-${Date.now()}`,
      text,
      priority: 'medium',
      day: 'any',
      category: 'techWork',
      done: false,
      createdAt: new Date()
    });
    await task.save();
    return `✅ Added: *${text}*`;
  },
  
  async report(args, settings) {
    const period = args[0] || 'today';
    const now = new Date();
    const weekKey = getCurrentWeekKey();
    
    // Get tasks completed today
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));
    
    const completedToday = await ApexTask.countDocuments({
      done: true,
      completedAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const pending = await ApexTask.countDocuments({ done: false });
    
    // Get habits for today
    const dayIndex = new Date().getDay();
    const habits = await ApexHabit.countDocuments({ weekKey, dayIndex });
    
    // Get gamification
    const gamification = await ApexGamification.findOne().sort({ updatedAt: -1 }) || {};
    
    let text = `📊 *Daily Report*\n\n`;
    text += `✅ Tasks completed: ${completedToday}\n`;
    text += `📝 Tasks pending: ${pending}\n`;
    text += `🎯 Habits tracked: ${habits}\n`;
    text += `⭐ XP: ${gamification.xp || 0} (Level ${gamification.level || 1})\n\n`;
    text += `Keep crushing it! 💪`;
    
    return text;
  },
  
  async schedule(args, settings) {
    const schedule = await ApexSchedule.findOne().sort({ createdAt: -1 });
    if (!schedule || !schedule.schedule) return 'No schedule found';
    
    const dayIndex = new Date().getDay();
    const todaySchedule = schedule.schedule[dayIndex];
    if (!todaySchedule) return 'No schedule for today';
    
    let text = '📅 *Today\'s Schedule:*\n\n';
    todaySchedule.forEach(block => {
      if (!block) return;
      const emoji = { sleep: '😴', work: '💼', workout: '💪', learn: '📚', rest: '☕', meal: '🍽️' }[block.activity] || '⏰';
      text += `${emoji} ${block.start}-${block.end}: ${block.activity.toUpperCase()}\n`;
    });
    return text;
  },
  
  async help(args, settings) {
    return `🤖 *APEX Bot Commands:*

📝 /tasks - List pending tasks
✅ /done <id> - Complete a task
➕ /add <text> - Add new task
📊 /report - Daily summary
📅 /schedule - Today's schedule
❓ /help - Show this help`;
  }
};

// Telegram bot webhook
router.post('/telegram-webhook', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.text) {
      return res.json({ ok: true });
    }
    
    const chatId = message.chat?.id;
    const text = message.text;
    
    // Store chatId if first message
    if (chatId) {
      await ApexSettings.findOneAndUpdate(
        {},
        { chatId: String(chatId) },
        { upsert: true }
      );
    }
    
    // Parse command
    const parts = text.split(' ');
    const commandName = parts[0].replace('/', '').split('@')[0]; // Remove / and bot name
    const args = parts.slice(1);
    
    // Get settings for bot token
    const settings = await ApexSettings.findOne();
    if (!settings?.botToken) {
      return res.json({ ok: true });
    }
    
    // Execute command
    const handler = telegramCommands[commandName] || telegramCommands.help;
    const response = await handler(args, settings);
    
    // Send response
    await sendTelegramMessage(settings.botToken, chatId, response);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
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
