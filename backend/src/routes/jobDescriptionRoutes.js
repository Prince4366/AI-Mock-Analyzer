import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { uploadJdFile } from "../middleware/upload.js";
import { listJds, parseJd, saveJd } from "../controllers/jobDescriptionController.js";

const router = Router();

router.use(protect);
router.post("/parse", uploadJdFile, parseJd);
router.post("/", saveJd);
router.get("/", listJds);

export default router;
