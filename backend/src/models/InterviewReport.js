import mongoose from "mongoose";

const interviewReportSchema = new mongoose.Schema(
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
    title: {
      type: String,
      default: "Interview Performance Report"
    },
    reportDate: {
      type: Date,
      default: Date.now
    },
    metadata: {
      userName: { type: String, default: "" },
      interviewType: { type: String, default: "" },
      roleTrack: { type: String, default: "" },
      difficulty: { type: String, default: "" }
    },
    summary: {
      overallScore: { type: Number, default: 0 },
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      recommendations: { type: [String], default: [] },
      roadmap: { type: [String], default: [] }
    },
    questionFeedback: {
      type: [
        {
          questionIndex: Number,
          question: String,
          overallScore: Number,
          feedbackSummary: String,
          strengths: [String],
          improvements: [String]
        }
      ],
      default: []
    },
    speechAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    facialPostureAnalytics: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const InterviewReport = mongoose.model("InterviewReport", interviewReportSchema);
