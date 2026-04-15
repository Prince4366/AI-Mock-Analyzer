import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getOrCreateCurrentWeeklyGoal,
  refreshWeeklyGoalProgress,
  setWeeklyGoal
} from "../services/weeklyGoalService.js";
import { AppError } from "../utils/AppError.js";

function shapeGoal(goal) {
  const progressPercent = Math.min(
    100,
    Math.round((goal.completedInterviews / goal.targetInterviews) * 100)
  );

  return {
    id: goal._id,
    weekStart: goal.weekStart,
    targetInterviews: goal.targetInterviews,
    completedInterviews: goal.completedInterviews,
    isCompleted: goal.isCompleted,
    progressPercent: Number.isFinite(progressPercent) ? progressPercent : 0
  };
}

export const getMyWeeklyGoal = asyncHandler(async (req, res) => {
  const goal = await refreshWeeklyGoalProgress(req.user._id);
  res.status(200).json({
    success: true,
    goal: shapeGoal(goal)
  });
});

export const setMyWeeklyGoal = asyncHandler(async (req, res) => {
  const { targetInterviews } = req.body;
  const target = Number(targetInterviews);

  if (!Number.isInteger(target) || target < 1 || target > 50) {
    throw new AppError("targetInterviews must be an integer between 1 and 50", 400);
  }

  const goal = await setWeeklyGoal(req.user._id, target);
  res.status(200).json({
    success: true,
    goal: shapeGoal(goal)
  });
});

export const ensureGoal = asyncHandler(async (req, res) => {
  const goal = await getOrCreateCurrentWeeklyGoal(req.user._id);
  res.status(200).json({
    success: true,
    goal: shapeGoal(goal)
  });
});
