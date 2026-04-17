import mongoose from "mongoose";
import { Resume } from "../models/Resume.js";
import { JobDescription } from "../models/JobDescription.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { AnswerEvaluation } from "../models/AnswerEvaluation.js";
import { InterviewReport } from "../models/InterviewReport.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateInterviewQuestions } from "../services/aiQuestionGenerator.js";
import { evaluateInterviewAnswer } from "../services/aiAnswerEvaluator.js";
import { generateFollowUpQuestion } from "../services/aiFollowUpGenerator.js";
import { registerInterviewCompletion } from "../services/streakService.js";
import { autoAwardBadgesForUser } from "../services/badgeService.js";
import { awardXpForCompletedInterview } from "../services/xpService.js";
import { refreshWeeklyGoalProgress } from "../services/weeklyGoalService.js";
import {
  adaptDifficulty,
  normalizeDifficulty
} from "../services/adaptiveDifficultyService.js";
import {
  buildInterviewReportData,
  generateInterviewPdfBuffer
} from "../services/interviewReportService.js";

const ALLOWED_DIFFICULTY = new Set(["Easy", "Medium", "Hard", "Expert"]);
const ALLOWED_ROLE_TRACKS = new Set([
  "Software Engineer",
  "Data Analyst",
  "AIML Engineer",
  "Product Manager",
  "HR/Behavioral"
]);

export const generateQuestions = asyncHandler(async (req, res) => {
  const {
    resumeId,
    jobDescriptionId,
    difficulty = "Medium",
    questionCount = 9,
    title,
    roleTrack = "Software Engineer"
  } =
    req.body;

  if (!resumeId || !jobDescriptionId) {
    throw new AppError("resumeId and jobDescriptionId are required", 400);
  }
  if (!mongoose.Types.ObjectId.isValid(resumeId) || !mongoose.Types.ObjectId.isValid(jobDescriptionId)) {
    throw new AppError("Invalid resumeId or jobDescriptionId", 400);
  }
  if (!ALLOWED_DIFFICULTY.has(difficulty)) {
    throw new AppError("difficulty must be Easy, Medium, Hard, or Expert", 400);
  }
  if (!ALLOWED_ROLE_TRACKS.has(roleTrack)) {
    throw new AppError("Invalid roleTrack selected", 400);
  }

  const boundedCount = Math.min(Math.max(Number(questionCount) || 9, 3), 18);

  const [resume, jobDescription] = await Promise.all([
    Resume.findOne({ _id: resumeId, userId: req.user._id }),
    JobDescription.findOne({ _id: jobDescriptionId, userId: req.user._id })
  ]);

  if (!resume) {
    throw new AppError("Resume not found", 404);
  }
  if (!jobDescription) {
    throw new AppError("Job description not found", 404);
  }

  const recentSessions = await InterviewSession.find({
    userId: req.user._id,
    roleTrack,
    jobDescriptionId
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("generatedQuestions.question");

  const avoidQuestions = recentSessions
    .flatMap((session) => session.generatedQuestions || [])
    .map((item) => String(item?.question || "").trim())
    .filter(Boolean);

  const questions = await generateInterviewQuestions({
    resume,
    jobDescription,
    difficulty,
    questionCount: boundedCount,
    roleTrack,
    avoidQuestions
  });

  const session = await InterviewSession.create({
    userId: req.user._id,
    resumeId: resume._id,
    jobDescriptionId: jobDescription._id,
    title: title || "Mock Interview Session",
    roleTrack,
    difficulty,
    currentDifficulty: difficulty,
    generatedQuestions: questions
  });
  console.info("[interviews.generateQuestions] Session created", {
    sessionId: String(session._id),
    userId: String(req.user._id),
    questionCount: questions.length,
    roleTrack,
    difficulty
  });

  res.status(201).json({
    success: true,
    session: {
      id: session._id,
      title: session.title,
      roleTrack: session.roleTrack,
      difficulty: session.difficulty,
      resumeId: session.resumeId,
      jobDescriptionId: session.jobDescriptionId,
      createdAt: session.createdAt
    },
    questions
  });
});

export const getSessionQuestions = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    console.warn("[interviews.getSessionQuestions] Invalid sessionId format", {
      sessionId,
      userId: String(req.user._id)
    });
    throw new AppError(`Invalid sessionId format: "${sessionId}"`, 400);
  }

  const session = await InterviewSession.findOne({
    _id: sessionId,
    userId: req.user._id
  });

  if (!session) {
    console.warn("[interviews.getSessionQuestions] Session not found", {
      sessionId,
      userId: String(req.user._id)
    });
    throw new AppError("Interview session not found", 404);
  }
  console.info("[interviews.getSessionQuestions] Session loaded", {
    sessionId: String(session._id),
    userId: String(req.user._id),
    status: session.status,
    questionCount: session.generatedQuestions?.length || 0
  });

  res.status(200).json({
    success: true,
    session: {
      id: session._id,
      title: session.title,
      roleTrack: session.roleTrack,
      difficulty: session.difficulty,
      currentDifficulty: session.currentDifficulty,
      createdAt: session.createdAt,
      difficultyProgression: session.difficultyProgression
    },
    questions: session.generatedQuestions
  });
});

export const evaluateSessionAnswer = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const { question, expectedAnswer, userAnswer, questionIndex = -1, speechMetrics } = req.body;
  if (!question || !userAnswer) {
    throw new AppError("question and userAnswer are required", 400);
  }
  const normalizedExpectedAnswer = String(expectedAnswer || "").trim() || String(question).trim();

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  if (questionIndex >= 0) {
    const sessionQuestion = session.generatedQuestions?.[questionIndex]?.question;
    if (sessionQuestion && sessionQuestion !== question) {
      throw new AppError("question does not match session question at questionIndex", 400);
    }
  }

  const evaluated = await evaluateInterviewAnswer({
    question,
    expectedAnswer: normalizedExpectedAnswer,
    userAnswer
  });

  const confidenceRaw = Number(speechMetrics?.confidenceScore);
  const hasConfidence = Number.isFinite(confidenceRaw);
  const clampedConfidence = hasConfidence ? Math.max(0, Math.min(100, confidenceRaw)) : null;
  const confidenceAsTen = hasConfidence ? Number((clampedConfidence / 10).toFixed(1)) : null;
  const blendedOverallScore = hasConfidence
    ? Number((evaluated.overallScore * 0.8 + confidenceAsTen * 0.2).toFixed(1))
    : evaluated.overallScore;
  const blendedFeedbackSummary = hasConfidence
    ? `${evaluated.feedback.summary} Delivery confidence: ${clampedConfidence}/100.`
    : evaluated.feedback.summary;

  const evaluation = await AnswerEvaluation.create({
    userId: req.user._id,
    sessionId: session._id,
    questionIndex,
    question,
    expectedAnswer: normalizedExpectedAnswer,
    userAnswer,
    scoreBreakdown: evaluated.scoreBreakdown,
    overallScore: blendedOverallScore,
    llmScore: evaluated.llmScore,
    semanticSimilarity: evaluated.semanticSimilarity,
    semanticSimilarityScore: evaluated.semanticSimilarityScore,
    feedback: {
      ...evaluated.feedback,
      summary: blendedFeedbackSummary
    }
  });

  const previousDifficulty = normalizeDifficulty(session.currentDifficulty || session.difficulty);
  const newDifficulty = adaptDifficulty(previousDifficulty, blendedOverallScore);
  session.currentDifficulty = newDifficulty;
  session.difficultyProgression.push({
    questionIndex,
    previousDifficulty,
    newDifficulty,
    triggerScore: blendedOverallScore
  });
  await session.save();

  res.status(201).json({
    success: true,
    evaluation: {
      id: evaluation._id,
      sessionId: evaluation.sessionId,
      questionIndex: evaluation.questionIndex,
      scores: evaluation.scoreBreakdown,
      llmScore: evaluation.llmScore,
      semanticSimilarity: evaluation.semanticSimilarity,
      semanticSimilarityScore: evaluation.semanticSimilarityScore,
      overallScore: evaluation.overallScore,
      adaptiveDifficulty: {
        previousDifficulty,
        newDifficulty
      },
      feedback: evaluation.feedback,
      createdAt: evaluation.createdAt
    }
  });
});

export const listSessionEvaluations = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  const evaluations = await AnswerEvaluation.find({
    sessionId: req.params.sessionId,
    userId: req.user._id
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    evaluations
  });
});

export const generateDynamicFollowUp = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const { rootQuestionIndex, previousAnswer, previousQuestion } = req.body;
  if (typeof rootQuestionIndex !== "number" || rootQuestionIndex < 0) {
    throw new AppError("rootQuestionIndex must be a non-negative number", 400);
  }
  if (!previousAnswer || !String(previousAnswer).trim()) {
    throw new AppError("previousAnswer is required", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  const rootQuestionNode = session.generatedQuestions[rootQuestionIndex];
  if (!rootQuestionNode) {
    throw new AppError("No generated question found for rootQuestionIndex", 404);
  }

  let chain = session.followUpChains.find((entry) => entry.rootQuestionIndex === rootQuestionIndex);
  if (!chain) {
    chain = {
      rootQuestionIndex,
      rootQuestion: rootQuestionNode.question,
      items: []
    };
    session.followUpChains.push(chain);
  }

  const expectedPreviousQuestion =
    chain.items.length === 0 ? rootQuestionNode.question : chain.items[chain.items.length - 1].question;
  if (previousQuestion && previousQuestion !== expectedPreviousQuestion) {
    throw new AppError("previousQuestion does not match expected conversation state", 400);
  }

  if (chain.items.length > 0) {
    const lastIndex = chain.items.length - 1;
    if (!chain.items[lastIndex].answer) {
      chain.items[lastIndex].answer = String(previousAnswer).trim();
    }
  }

  session.conversationHistory.push({
    role: "interviewer",
    text: expectedPreviousQuestion,
    questionIndex: rootQuestionIndex,
    followUpLevel: chain.items.length
  });
  session.conversationHistory.push({
    role: "candidate",
    text: String(previousAnswer).trim(),
    questionIndex: rootQuestionIndex,
    followUpLevel: chain.items.length
  });

  const nextLevel = chain.items.length + 1;
  if (nextLevel > 3) {
    throw new AppError("Maximum follow-up depth of 3 reached", 400);
  }

  const contextualHistory = session.conversationHistory.filter(
    (turn) => turn.questionIndex === rootQuestionIndex
  );

  const generated = await generateFollowUpQuestion({
    rootQuestion: rootQuestionNode.question,
    previousAnswer: String(previousAnswer).trim(),
    conversationHistory: contextualHistory,
    level: nextLevel,
    difficulty: session.currentDifficulty || rootQuestionNode.difficulty,
    category: rootQuestionNode.category
  });

  chain.items.push({
    level: nextLevel,
    question: generated.question,
    answer: ""
  });

  session.conversationHistory.push({
    role: "interviewer",
    text: generated.question,
    questionIndex: rootQuestionIndex,
    followUpLevel: nextLevel
  });

  await session.save();

  res.status(201).json({
    success: true,
    followUp: {
      rootQuestionIndex,
      level: nextLevel,
      question: generated.question,
      intent: generated.intent
    },
    chain: session.followUpChains.find((entry) => entry.rootQuestionIndex === rootQuestionIndex)
  });
});

export const getConversationHistory = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  res.status(200).json({
    success: true,
    conversationHistory: session.conversationHistory,
    followUpChains: session.followUpChains
  });
});

export const listInterviewSessions = asyncHandler(async (req, res) => {
  const sessions = await InterviewSession.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .select("title roleTrack difficulty createdAt generatedQuestions");

  res.status(200).json({
    success: true,
    sessions: sessions.map((session) => ({
      id: session._id,
      title: session.title,
      roleTrack: session.roleTrack,
      difficulty: session.difficulty,
      questionCount: session.generatedQuestions?.length || 0,
      createdAt: session.createdAt
    }))
  });
});

export const getInterviewSessionDetail = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  const evaluations = await AnswerEvaluation.find({
    sessionId: session._id,
    userId: req.user._id
  }).sort({ questionIndex: 1, createdAt: 1 });

  res.status(200).json({
    success: true,
    session: {
      id: session._id,
      title: session.title,
      roleTrack: session.roleTrack,
      difficulty: session.difficulty,
      currentDifficulty: session.currentDifficulty,
      createdAt: session.createdAt,
      questions: session.generatedQuestions,
      followUpChains: session.followUpChains,
      conversationHistory: session.conversationHistory,
      difficultyProgression: session.difficultyProgression,
      webcamAnalytics: session.webcamAnalytics,
      speechAnswerAnalytics: session.speechAnswerAnalytics
    },
    evaluations
  });
});

export const compareInterviewSessions = asyncHandler(async (req, res) => {
  const { firstSessionId, secondSessionId } = req.body;
  if (
    !mongoose.Types.ObjectId.isValid(firstSessionId) ||
    !mongoose.Types.ObjectId.isValid(secondSessionId)
  ) {
    throw new AppError("firstSessionId and secondSessionId must be valid IDs", 400);
  }
  if (firstSessionId === secondSessionId) {
    throw new AppError("Please choose two different sessions to compare", 400);
  }

  const sessions = await InterviewSession.find({
    _id: { $in: [firstSessionId, secondSessionId] },
    userId: req.user._id
  });
  if (sessions.length !== 2) {
    throw new AppError("One or both sessions not found", 404);
  }

  const evaluations = await AnswerEvaluation.find({
    sessionId: { $in: [firstSessionId, secondSessionId] },
    userId: req.user._id
  });

  function summarize(sessionId) {
    const items = evaluations.filter((item) => item.sessionId.toString() === String(sessionId));
    const avgOverall =
      items.length > 0
        ? Number(
            (
              items.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) / items.length
            ).toFixed(2)
          )
        : 0;

    const avgDimensions = {
      relevance: 0,
      technicalDepth: 0,
      communicationClarity: 0,
      completeness: 0
    };

    if (items.length > 0) {
      Object.keys(avgDimensions).forEach((key) => {
        avgDimensions[key] = Number(
          (
            items.reduce(
              (sum, item) => sum + Number(item.scoreBreakdown?.[key] || 0),
              0
            ) / items.length
          ).toFixed(2)
        );
      });
    }

    return {
      totalEvaluatedAnswers: items.length,
      averageOverallScore: avgOverall,
      averageDimensions: avgDimensions
    };
  }

  const first = sessions.find((session) => String(session._id) === String(firstSessionId));
  const second = sessions.find((session) => String(session._id) === String(secondSessionId));
  const firstSummary = summarize(first._id);
  const secondSummary = summarize(second._id);

  res.status(200).json({
    success: true,
    comparison: {
      first: {
        id: first._id,
        title: first.title,
        createdAt: first.createdAt,
        ...firstSummary
      },
      second: {
        id: second._id,
        title: second.title,
        createdAt: second.createdAt,
        ...secondSummary
      },
      delta: {
        overallScore: Number(
          (secondSummary.averageOverallScore - firstSummary.averageOverallScore).toFixed(2)
        ),
        relevance: Number(
          (
            secondSummary.averageDimensions.relevance -
            firstSummary.averageDimensions.relevance
          ).toFixed(2)
        ),
        technicalDepth: Number(
          (
            secondSummary.averageDimensions.technicalDepth -
            firstSummary.averageDimensions.technicalDepth
          ).toFixed(2)
        ),
        communicationClarity: Number(
          (
            secondSummary.averageDimensions.communicationClarity -
            firstSummary.averageDimensions.communicationClarity
          ).toFixed(2)
        ),
        completeness: Number(
          (
            secondSummary.averageDimensions.completeness -
            firstSummary.averageDimensions.completeness
          ).toFixed(2)
        )
      }
    }
  });
});

export const completeInterviewSession = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  if (session.status !== "completed") {
    session.status = "completed";
    session.completedAt = new Date();
  }

  if (req.body?.webcamAnalytics && typeof req.body.webcamAnalytics === "object") {
    session.webcamAnalytics = req.body.webcamAnalytics;
  }
  await session.save();

  const evaluations = await AnswerEvaluation.find({
    sessionId: session._id,
    userId: req.user._id
  }).select("overallScore");
  const interviewScoreOutOf10 =
    evaluations.length === 0
      ? 0
      : Number(
          (
            evaluations.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) /
            evaluations.length
          ).toFixed(1)
        );

  const streak = await registerInterviewCompletion(req.user._id, session.completedAt);
  const newlyAwardedBadges = await autoAwardBadgesForUser(req.user._id);
  const xpProgress = await awardXpForCompletedInterview(req.user._id, session._id);
  const weeklyGoal = await refreshWeeklyGoalProgress(req.user._id);

  res.status(200).json({
    success: true,
    session: {
      id: session._id,
      status: session.status,
      completedAt: session.completedAt,
      webcamAnalytics: session.webcamAnalytics
    },
    interviewScoreOutOf10,
    streak: {
      currentDailyStreak: streak.currentDailyStreak,
      currentWeeklyStreak: streak.currentWeeklyStreak,
      weeklyStatus: streak.weeklyStatus
    },
    newlyAwardedBadges,
    xpProgress,
    weeklyGoal: {
      targetInterviews: weeklyGoal.targetInterviews,
      completedInterviews: weeklyGoal.completedInterviews,
      isCompleted: weeklyGoal.isCompleted
    }
  });
});

export const getWebcamSummary = asyncHandler(async (req, res) => {
  const sessions = await InterviewSession.find({
    userId: req.user._id,
    status: "completed",
    webcamAnalytics: { $ne: null }
  })
    .sort({ completedAt: -1 })
    .limit(20)
    .select("completedAt webcamAnalytics roleTrack");

  if (sessions.length === 0) {
    return res.status(200).json({
      success: true,
      summary: null
    });
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const eye = avg(sessions.map((s) => Number(s.webcamAnalytics?.eyeContactPercent || 0)));
  const smile = avg(sessions.map((s) => Number(s.webcamAnalytics?.smileFrequencyPercent || 0)));
  const posture = avg(sessions.map((s) => Number(s.webcamAnalytics?.postureQualityPercent || 0)));
  const confidence = avg(sessions.map((s) => Number(s.webcamAnalytics?.confidenceScore || 0)));

  res.status(200).json({
    success: true,
    summary: {
      sessionsAnalyzed: sessions.length,
      eyeContactPercent: Number(eye.toFixed(1)),
      smileFrequencyPercent: Number(smile.toFixed(1)),
      postureQualityPercent: Number(posture.toFixed(1)),
      confidenceScore: Number(confidence.toFixed(1)),
      latest: sessions[0]
    }
  });
});

export const saveSpeechAnswerAnalytics = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const {
    questionIndex,
    wordsPerMinute,
    pauseCount,
    averagePauseMs,
    fillerWordCount,
    fillerWordRatio,
    confidenceScore,
    transcriptWordCount,
    feedback
  } = req.body || {};

  if (typeof questionIndex !== "number" || questionIndex < 0) {
    throw new AppError("questionIndex must be a non-negative number", 400);
  }

  const session = await InterviewSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id
  });
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  const sanitizedEntry = {
    questionIndex,
    wordsPerMinute: Number(wordsPerMinute || 0),
    pauseCount: Number(pauseCount || 0),
    averagePauseMs: Number(averagePauseMs || 0),
    fillerWordCount: Number(fillerWordCount || 0),
    fillerWordRatio: Number(fillerWordRatio || 0),
    confidenceScore: Number(confidenceScore || 0),
    transcriptWordCount: Number(transcriptWordCount || 0),
    feedback: {
      strengths: Array.isArray(feedback?.strengths) ? feedback.strengths : [],
      improvements: Array.isArray(feedback?.improvements) ? feedback.improvements : []
    },
    createdAt: new Date()
  };

  const existingIndex = session.speechAnswerAnalytics.findIndex(
    (item) => item.questionIndex === questionIndex
  );
  if (existingIndex >= 0) {
    session.speechAnswerAnalytics[existingIndex] = sanitizedEntry;
  } else {
    session.speechAnswerAnalytics.push(sanitizedEntry);
  }
  await session.save();

  res.status(200).json({
    success: true,
    speechAnswerAnalytics: sanitizedEntry
  });
});

export const getSpeechSummary = asyncHandler(async (req, res) => {
  const sessions = await InterviewSession.find({
    userId: req.user._id,
    "speechAnswerAnalytics.0": { $exists: true }
  }).select("speechAnswerAnalytics");

  const entries = sessions.flatMap((session) => session.speechAnswerAnalytics || []);
  if (entries.length === 0) {
    return res.status(200).json({
      success: true,
      summary: null
    });
  }

  const avg = (arr) => arr.reduce((sum, value) => sum + Number(value || 0), 0) / arr.length;
  const avgWpm = avg(entries.map((item) => item.wordsPerMinute));
  const avgPauseCount = avg(entries.map((item) => item.pauseCount));
  const avgPauseMs = avg(entries.map((item) => item.averagePauseMs));
  const avgFillerRatio = avg(entries.map((item) => item.fillerWordRatio));
  const avgConfidence = avg(entries.map((item) => item.confidenceScore));

  const strengths = [];
  const weaknesses = [];
  if (avgWpm >= 105 && avgWpm <= 165) strengths.push("Speaking pace is in an interview-friendly range.");
  else weaknesses.push("Pace is inconsistent. Aim around 110-160 words per minute.");
  if (avgFillerRatio <= 8) strengths.push("Low filler-word usage improves clarity.");
  else weaknesses.push("High filler-word ratio detected. Practice concise pauses instead.");
  if (avgConfidence >= 70) strengths.push("Delivery confidence is strong across answers.");
  else weaknesses.push("Confidence appears moderate. Use a steadier pace and fewer fillers.");

  res.status(200).json({
    success: true,
    summary: {
      answersAnalyzed: entries.length,
      averageWordsPerMinute: Number(avgWpm.toFixed(1)),
      averagePauseCount: Number(avgPauseCount.toFixed(1)),
      averagePauseMs: Number(avgPauseMs.toFixed(0)),
      averageFillerWordRatio: Number(avgFillerRatio.toFixed(1)),
      averageConfidenceScore: Number(avgConfidence.toFixed(1)),
      strengths,
      weaknesses
    }
  });
});

export const generateInterviewReport = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    throw new AppError("Invalid sessionId", 400);
  }

  const [session, user] = await Promise.all([
    InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id
    }),
    User.findById(req.user._id).select("name")
  ]);
  if (!session) {
    throw new AppError("Interview session not found", 404);
  }

  const reportPayload = await buildInterviewReportData({ user, session });
  const report = await InterviewReport.create({
    userId: req.user._id,
    sessionId: session._id,
    metadata: reportPayload.metadata,
    summary: reportPayload.summary,
    questionFeedback: reportPayload.questionFeedback,
    speechAnalytics: reportPayload.speechAnalytics,
    facialPostureAnalytics: reportPayload.facialPostureAnalytics
  });

  res.status(201).json({
    success: true,
    report: {
      id: report._id,
      sessionId: report.sessionId,
      createdAt: report.createdAt
    }
  });
});

export const listInterviewReports = asyncHandler(async (req, res) => {
  const reports = await InterviewReport.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .select("sessionId metadata summary createdAt");

  res.status(200).json({
    success: true,
    reports
  });
});

export const downloadInterviewReportPdf = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) {
    throw new AppError("Invalid reportId", 400);
  }

  const report = await InterviewReport.findOne({
    _id: req.params.reportId,
    userId: req.user._id
  });
  if (!report) {
    throw new AppError("Interview report not found", 404);
  }

  const session = await InterviewSession.findOne({
    _id: report.sessionId,
    userId: req.user._id
  }).select("title roleTrack difficulty");

  const pdfBuffer = await generateInterviewPdfBuffer({ report, session });
  const fileName = `interview-report-${String(report._id)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(200).send(pdfBuffer);
});
