import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  ensureGoal,
  getMyWeeklyGoal,
  setMyWeeklyGoal
} from "../controllers/weeklyGoalController.js";

const router = Router();
router.use(protect);

router.get("/me", getMyWeeklyGoal);
router.post("/me", setMyWeeklyGoal);
router.post("/ensure", ensureGoal);

export default router;
