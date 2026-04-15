import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getMyBadges } from "../controllers/badgeController.js";

const router = Router();
router.use(protect);

router.get("/me", getMyBadges);

export default router;
