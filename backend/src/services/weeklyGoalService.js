import { WeeklyGoal } from "../models/WeeklyGoal.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { User } from "../models/User.js";

const DEFAULT_TARGET = 3;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

async function countCompletedInWeek(userId, weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return InterviewSession.countDocuments({
    userId,
    status: "completed",
    completedAt: { $gte: weekStart, $lt: weekEnd }
  });
}

export async function getOrCreateCurrentWeeklyGoal(userId) {
  const weekStart = startOfWeek(new Date());
  let goal = await WeeklyGoal.findOne({ userId, weekStart });
  if (!goal) {
    const completed = await countCompletedInWeek(userId, weekStart);
    goal = await WeeklyGoal.create({
      userId,
      weekStart,
      targetInterviews: DEFAULT_TARGET,
      completedInterviews: completed,
      isCompleted: completed >= DEFAULT_TARGET
    });
  }
  return goal;
}

export async function setWeeklyGoal(userId, targetInterviews) {
  const weekStart = startOfWeek(new Date());
  const completed = await countCompletedInWeek(userId, weekStart);

  const goal = await WeeklyGoal.findOneAndUpdate(
    { userId, weekStart },
    {
      $set: {
        targetInterviews,
        completedInterviews: completed,
        isCompleted: completed >= targetInterviews
      },
      $setOnInsert: { userId, weekStart }
    },
    { upsert: true, new: true }
  );

  return goal;
}

export async function refreshWeeklyGoalProgress(userId) {
  const goal = await getOrCreateCurrentWeeklyGoal(userId);
  const completed = await countCompletedInWeek(userId, goal.weekStart);
  goal.completedInterviews = completed;
  goal.isCompleted = completed >= goal.targetInterviews;
  await goal.save();
  return goal;
}

export async function runWeeklyGoalResetValidationJob() {
  const users = await User.find({}).select("_id");
  await Promise.all(users.map((user) => getOrCreateCurrentWeeklyGoal(user._id)));
}
