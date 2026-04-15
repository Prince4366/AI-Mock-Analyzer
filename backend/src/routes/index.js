import { Router } from "express";
import authRoutes from "./authRoutes.js";
import { protect } from "../middleware/auth.js";
import resumeRoutes from "./resumeRoutes.js";
import jobDescriptionRoutes from "./jobDescriptionRoutes.js";
import interviewRoutes from "./interviewRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import streakRoutes from "./streakRoutes.js";
import badgeRoutes from "./badgeRoutes.js";
import progressRoutes from "./progressRoutes.js";
import weeklyGoalRoutes from "./weeklyGoalRoutes.js";
import benchmarkRoutes from "./benchmarkRoutes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "API is healthy" });
});

router.use("/auth", authRoutes);
router.use("/resumes", resumeRoutes);
router.use("/job-descriptions", jobDescriptionRoutes);
router.use("/interviews", interviewRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/streak", streakRoutes);
router.use("/badges", badgeRoutes);
router.use("/progress", progressRoutes);
router.use("/weekly-goals", weeklyGoalRoutes);
router.use("/benchmark", benchmarkRoutes);

router.get("/protected", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Protected resource accessed",
    user: {
      id: req.user._id,
      email: req.user.email
    }
  });
});

export default router;
