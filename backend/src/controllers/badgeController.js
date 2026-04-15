import { asyncHandler } from "../utils/asyncHandler.js";
import { getUserBadgeShowcase } from "../services/badgeService.js";

export const getMyBadges = asyncHandler(async (req, res) => {
  const badges = await getUserBadgeShowcase(req.user._id);
  res.status(200).json({
    success: true,
    ...badges
  });
});
