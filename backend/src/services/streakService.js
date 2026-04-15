import { User } from "../models/User.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { UserStreak } from "../models/UserStreak.js";

const WEEKLY_TARGET_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date) {
  return startOfDay(date).toISOString();
}

function diffInDays(a, b) {
  return Math.floor((startOfDay(a) - startOfDay(b)) / DAY_MS);
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

async function countCompletedDaysInWeek(userId, weekStartDate) {
  const weekStart = startOfWeek(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sessions = await InterviewSession.find({
    userId,
    status: "completed",
    completedAt: { $gte: weekStart, $lt: weekEnd }
  }).select("completedAt");

  const uniqueDayKeys = new Set(sessions.map((session) => toDateKey(session.completedAt)));
  return uniqueDayKeys.size;
}

async function buildRecent7Days(userId, now) {
  const start = startOfDay(new Date(now.getTime() - 6 * DAY_MS));
  const end = new Date(startOfDay(now).getTime() + DAY_MS);
  const sessions = await InterviewSession.find({
    userId,
    status: "completed",
    completedAt: { $gte: start, $lt: end }
  }).select("completedAt");

  const completedKeys = new Set(sessions.map((session) => toDateKey(session.completedAt)));
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start.getTime() + i * DAY_MS);
    days.push({
      date,
      completed: completedKeys.has(toDateKey(date))
    });
  }
  return days;
}

async function getOrCreate(userId) {
  let streak = await UserStreak.findOne({ userId });
  if (!streak) {
    streak = await UserStreak.create({ userId });
  }
  return streak;
}

export async function validateAndRefreshStreak(userId, now = new Date()) {
  const streak = await getOrCreate(userId);

  if (streak.lastCompletionDate) {
    const gap = diffInDays(now, streak.lastCompletionDate);
    if (gap > 1) {
      streak.currentDailyStreak = 0;
    }
  }

  const currentWeekStart = startOfWeek(now);
  const hasWeeklyStatus =
    streak.weeklyStatus && toDateKey(streak.weeklyStatus.weekStart) === toDateKey(currentWeekStart);

  if (!hasWeeklyStatus) {
    if (streak.weeklyStatus?.achieved) {
      const previousWeekStart = startOfWeek(new Date(currentWeekStart.getTime() - 7 * DAY_MS));
      const contiguous =
        toDateKey(streak.weeklyStatus.weekStart) === toDateKey(previousWeekStart);
      streak.currentWeeklyStreak = contiguous ? streak.currentWeeklyStreak + 1 : 1;
      streak.longestWeeklyStreak = Math.max(
        streak.longestWeeklyStreak || 0,
        streak.currentWeeklyStreak
      );
    } else if (streak.weeklyStatus) {
      streak.currentWeeklyStreak = 0;
    }

    const completedDays = await countCompletedDaysInWeek(userId, now);
    streak.weeklyStatus = {
      weekStart: currentWeekStart,
      completedDays,
      targetDays: WEEKLY_TARGET_DAYS,
      achieved: completedDays >= WEEKLY_TARGET_DAYS
    };
  } else {
    const completedDays = await countCompletedDaysInWeek(userId, now);
    streak.weeklyStatus.completedDays = completedDays;
    streak.weeklyStatus.achieved = completedDays >= WEEKLY_TARGET_DAYS;
  }

  streak.recent7Days = await buildRecent7Days(userId, now);
  await streak.save();
  return streak;
}

export async function registerInterviewCompletion(userId, completedAt = new Date()) {
  const streak = await validateAndRefreshStreak(userId, completedAt);

  const last = streak.lastCompletionDate;
  const gap = last ? diffInDays(completedAt, last) : null;

  if (gap === null) {
    streak.currentDailyStreak = 1;
  } else if (gap === 1) {
    streak.currentDailyStreak += 1;
  } else if (gap > 1) {
    streak.currentDailyStreak = 1;
  }

  streak.longestDailyStreak = Math.max(
    streak.longestDailyStreak || 0,
    streak.currentDailyStreak
  );
  streak.lastCompletionDate = completedAt;

  const completedDays = await countCompletedDaysInWeek(userId, completedAt);
  streak.weeklyStatus = {
    weekStart: startOfWeek(completedAt),
    completedDays,
    targetDays: WEEKLY_TARGET_DAYS,
    achieved: completedDays >= WEEKLY_TARGET_DAYS
  };

  streak.recent7Days = await buildRecent7Days(userId, completedAt);
  await streak.save();
  return streak;
}

export async function runStreakResetValidationJob() {
  const users = await User.find({}).select("_id");
  await Promise.all(users.map((user) => validateAndRefreshStreak(user._id)));
}
