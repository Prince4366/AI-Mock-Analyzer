import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  computeWeaknessAnalysis,
  getDashboardAnalytics,
  getLatestWeaknessAnalysis
} from "../controllers/analyticsController.js";

const router = Router();

router.use(protect);
router.post("/weakness-analysis", computeWeaknessAnalysis);
router.get("/weakness-analysis/latest", getLatestWeaknessAnalysis);
router.get("/dashboard", getDashboardAnalytics);

export default router;
