import { asyncHandler } from "../utils/asyncHandler.js";
import { getUserProgress } from "../services/xpService.js";

export const getMyProgress = asyncHandler(async (req, res) => {
  const progress = await getUserProgress(req.user._id);
  const percent = Math.round((progress.xpIntoCurrentLevel / progress.xpForNextLevel) * 100);

  res.status(200).json({
    success: true,
    progress: {
      level: progress.level,
      totalXp: progress.totalXp,
      xpIntoCurrentLevel: progress.xpIntoCurrentLevel,
      xpForNextLevel: progress.xpForNextLevel,
      progressPercent: Number.isFinite(percent) ? percent : 0
    }
  });
});
