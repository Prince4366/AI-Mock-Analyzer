import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getMyStreak } from "../controllers/streakController.js";

const router = Router();
router.use(protect);

router.get("/me", getMyStreak);

export default router;
