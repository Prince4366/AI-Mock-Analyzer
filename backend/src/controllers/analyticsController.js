import { AnswerEvaluation } from "../models/AnswerEvaluation.js";
import { UserAnalytics } from "../models/UserAnalytics.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { buildWeaknessAnalysis } from "../services/weaknessAnalysis.js";
import { InterviewSession } from "../models/InterviewSession.js";

function topicFromQuestion(question) {
  const words = String(question || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  return words.slice(0, 2).join(" / ") || "general";
}

export const computeWeaknessAnalysis = asyncHandler(async (req, res) => {
  const evaluations = await AnswerEvaluation.find({ userId: req.user._id }).sort({
    createdAt: -1
  });

  if (evaluations.length === 0) {
    throw new AppError("No interview evaluations found for this user", 404);
  }

  const analysis = buildWeaknessAnalysis(evaluations);

  const snapshot = await UserAnalytics.create({
    userId: req.user._id,
    ...analysis
  });

  res.status(201).json({
    success: true,
    analytics: snapshot
  });
});

export const getLatestWeaknessAnalysis = asyncHandler(async (req, res) => {
  const latest = await UserAnalytics.findOne({ userId: req.user._id }).sort({
    createdAt: -1
  });

  if (!latest) {
    throw new AppError("No analytics snapshot found. Generate one first.", 404);
  }

  res.status(200).json({
    success: true,
    analytics: latest
  });
});

export const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const roleTrack = req.query.roleTrack;
  console.info("[analytics.getDashboardAnalytics] Request received", {
    userId: String(req.user?._id || ""),
    roleTrack: roleTrack || "All"
  });

  let evaluationFilter = { userId: req.user._id };
  if (roleTrack) {
    const sessions = await InterviewSession.find({
      userId: req.user._id,
      roleTrack
    }).select("_id");
    const sessionIds = sessions.map((session) => session._id);
    evaluationFilter = {
      ...evaluationFilter,
      sessionId: { $in: sessionIds }
    };
  }

  const evaluations = await AnswerEvaluation.find(evaluationFilter).sort({
    createdAt: 1
  });

  if (evaluations.length === 0) {
    console.info("[analytics.getDashboardAnalytics] No evaluations found", {
      userId: String(req.user?._id || ""),
      roleTrack: roleTrack || "All",
      evaluationFilter
    });
    return res.status(200).json({
      success: true,
      roleTrack: roleTrack || "All",
      charts: {
        overallScoreTrend: [],
        topicPerformance: [],
        weaknessRadar: [],
        interviewTimeline: [],
        improvementOverTime: []
      },
      recommendations: []
    });
  }

  const analysis = buildWeaknessAnalysis(evaluations);

  const overallScoreTrend = evaluations.map((item, idx) => ({
    index: idx + 1,
    date: item.createdAt,
    score: Number(item.overallScore.toFixed(2))
  }));

  const topicBuckets = new Map();
  for (const item of evaluations) {
    const topic = topicFromQuestion(item.question);
    if (!topicBuckets.has(topic)) {
      topicBuckets.set(topic, []);
    }
    topicBuckets.get(topic).push(item.overallScore);
  }
  const topicPerformance = Array.from(topicBuckets.entries()).map(([topic, scores]) => ({
    topic,
    score: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
  }));

  const weaknessRadar = analysis.weakDimensions.map((entry) => ({
    dimension: entry.dimension,
    score: Number(entry.averageScore.toFixed(2)),
    deficit: Number((10 - entry.averageScore).toFixed(2))
  }));

  const interviewTimeline = evaluations.map((item) => ({
    date: item.createdAt,
    question: item.question,
    score: Number(item.overallScore.toFixed(2))
  }));

  let rolling = 0;
  const improvementOverTime = evaluations.map((item, idx) => {
    rolling += item.overallScore;
    const runningAvg = rolling / (idx + 1);
    return {
      point: idx + 1,
      score: Number(item.overallScore.toFixed(2)),
      runningAvg: Number(runningAvg.toFixed(2))
    };
  });

  res.status(200).json({
    success: true,
    roleTrack: roleTrack || "All",
    charts: {
      overallScoreTrend,
      topicPerformance,
      weaknessRadar,
      interviewTimeline,
      improvementOverTime
    },
    recommendations: analysis.recommendations
  });
});
