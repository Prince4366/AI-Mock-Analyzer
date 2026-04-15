import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getMyProgress } from "../controllers/progressController.js";

const router = Router();
router.use(protect);

router.get("/me", getMyProgress);

export default router;
