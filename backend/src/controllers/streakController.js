import { asyncHandler } from "../utils/asyncHandler.js";
import { validateAndRefreshStreak } from "../services/streakService.js";

export const getMyStreak = asyncHandler(async (req, res) => {
  const streak = await validateAndRefreshStreak(req.user._id);
  res.status(200).json({
    success: true,
    streak: {
      currentDailyStreak: streak.currentDailyStreak,
      longestDailyStreak: streak.longestDailyStreak,
      currentWeeklyStreak: streak.currentWeeklyStreak,
      longestWeeklyStreak: streak.longestWeeklyStreak,
      lastCompletionDate: streak.lastCompletionDate,
      weeklyStatus: streak.weeklyStatus,
      recent7Days: streak.recent7Days
    }
  });
});
