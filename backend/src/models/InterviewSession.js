import mongoose from "mongoose";

const generatedQuestionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["technical", "hr", "behavioral"],
      required: true
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true
    },
    question: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const followUpNodeSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 3
    },
    question: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      default: ""
    }
  },
  { _id: true }
);

const followUpChainSchema = new mongoose.Schema(
  {
    rootQuestionIndex: {
      type: Number,
      required: true
    },
    rootQuestion: {
      type: String,
      required: true
    },
    items: {
      type: [followUpNodeSchema],
      default: []
    }
  },
  { _id: false }
);

const conversationTurnSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["interviewer", "candidate"],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    questionIndex: {
      type: Number,
      default: -1
    },
    followUpLevel: {
      type: Number,
      default: 0
    }
  },
  { _id: false, timestamps: true }
);

const difficultyProgressionSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, default: -1 },
    previousDifficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Expert"],
      required: true
    },
    newDifficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Expert"],
      required: true
    },
    triggerScore: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const webcamAnalyticsSchema = new mongoose.Schema(
  {
    totalFrames: { type: Number, default: 0 },
    eyeContactPercent: { type: Number, default: 0 },
    smileFrequencyPercent: { type: Number, default: 0 },
    postureQualityPercent: { type: Number, default: 0 },
    headTiltAlerts: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    feedback: {
      posture: { type: String, default: "" },
      confidence: { type: String, default: "" },
      eyeContact: { type: String, default: "" }
    }
  },
  { _id: false }
);

const speechAnswerAnalyticsSchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    wordsPerMinute: { type: Number, default: 0 },
    pauseCount: { type: Number, default: 0 },
    averagePauseMs: { type: Number, default: 0 },
    fillerWordCount: { type: Number, default: 0 },
    fillerWordRatio: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    transcriptWordCount: { type: Number, default: 0 },
    feedback: {
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] }
    },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDescription",
      required: true
    },
    title: {
      type: String,
      default: "Mock Interview Session"
    },
    roleTrack: {
      type: String,
      enum: [
        "Software Engineer",
        "Data Analyst",
        "AIML Engineer",
        "Product Manager",
        "HR/Behavioral"
      ],
      default: "Software Engineer",
      index: true
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Expert"],
      required: true
    },
    currentDifficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Expert"],
      default: "Medium"
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress"
    },
    completedAt: {
      type: Date,
      default: null
    },
    generatedQuestions: {
      type: [generatedQuestionSchema],
      default: []
    },
    followUpChains: {
      type: [followUpChainSchema],
      default: []
    },
    conversationHistory: {
      type: [conversationTurnSchema],
      default: []
    },
    difficultyProgression: {
      type: [difficultyProgressionSchema],
      default: []
    },
    webcamAnalytics: {
      type: webcamAnalyticsSchema,
      default: null
    },
    speechAnswerAnalytics: {
      type: [speechAnswerAnalyticsSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);
