import mongoose from "mongoose";

const scoreBreakdownSchema = new mongoose.Schema(
  {
    relevance: { type: Number, required: true, min: 0, max: 10 },
    technicalDepth: { type: Number, required: true, min: 0, max: 10 },
    communicationClarity: { type: Number, required: true, min: 0, max: 10 },
    completeness: { type: Number, required: true, min: 0, max: 10 }
  },
  { _id: false }
);

const answerEvaluationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      required: true,
      index: true
    },
    questionIndex: {
      type: Number,
      default: -1
    },
    question: {
      type: String,
      required: true
    },
    expectedAnswer: {
      type: String,
      required: true
    },
    userAnswer: {
      type: String,
      required: true
    },
    scoreBreakdown: {
      type: scoreBreakdownSchema,
      required: true
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    llmScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    semanticSimilarity: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    semanticSimilarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    feedback: {
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      summary: { type: String, default: "" }
    }
  },
  {
    timestamps: true
  }
);

export const AnswerEvaluation = mongoose.model(
  "AnswerEvaluation",
  answerEvaluationSchema
);
