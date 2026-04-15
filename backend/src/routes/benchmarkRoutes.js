import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getMyBenchmark } from "../controllers/benchmarkController.js";

const router = Router();
router.use(protect);

router.get("/me", getMyBenchmark);

export default router;
