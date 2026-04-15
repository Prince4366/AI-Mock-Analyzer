import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  compareInterviewSessions,
  completeInterviewSession,
  downloadInterviewReportPdf,
  generateDynamicFollowUp,
  generateInterviewReport,
  evaluateSessionAnswer,
  generateQuestions,
  getSpeechSummary,
  getWebcamSummary,
  getConversationHistory,
  getInterviewSessionDetail,
  getSessionQuestions,
  listInterviewSessions,
  listInterviewReports,
  listSessionEvaluations,
  saveSpeechAnswerAnalytics
} from "../controllers/interviewController.js";

const router = Router();

router.use(protect);
router.post("/generate-questions", generateQuestions);
router.get("/reports/history", listInterviewReports);
router.get("/reports/:reportId/download", downloadInterviewReportPdf);
router.get("/speech-summary", getSpeechSummary);
router.get("/webcam-summary", getWebcamSummary);
router.get("/history", listInterviewSessions);
router.post("/compare", compareInterviewSessions);
router.post("/:sessionId/complete", completeInterviewSession);
router.get("/:sessionId/questions", getSessionQuestions);
router.get("/:sessionId/detail", getInterviewSessionDetail);
router.post("/:sessionId/evaluate-answer", evaluateSessionAnswer);
router.post("/:sessionId/report", generateInterviewReport);
router.post("/:sessionId/speech-analytics", saveSpeechAnswerAnalytics);
router.get("/:sessionId/evaluations", listSessionEvaluations);
router.post("/:sessionId/follow-up", generateDynamicFollowUp);
router.get("/:sessionId/conversation-history", getConversationHistory);

export default router;
