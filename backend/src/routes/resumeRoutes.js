import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { uploadResumePdf } from "../middleware/upload.js";
import {
  listMyResumes,
  parseResume,
  saveParsedResume
} from "../controllers/resumeController.js";

const router = Router();

router.use(protect);
router.post("/parse", uploadResumePdf, parseResume);
router.post("/", saveParsedResume);
router.get("/", listMyResumes);

export default router;
