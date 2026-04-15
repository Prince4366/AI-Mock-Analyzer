import mongoose from "mongoose";

const weakDimensionSchema = new mongoose.Schema(
  {
    dimension: { type: String, required: true },
    averageScore: { type: Number, required: true },
    sampleSize: { type: Number, required: true }
  },
  { _id: false }
);

const weakTopicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    averageScore: { type: Number, required: true },
    occurrences: { type: Number, required: true },
    relatedSkills: { type: [String], default: [] }
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    area: { type: String, required: true },
    recommendation: { type: String, required: true }
  },
  { _id: false }
);

const userAnalyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    summary: {
      answersAnalyzed: { type: Number, default: 0 },
      averageOverallScore: { type: Number, default: 0 }
    },
    weakDimensions: {
      type: [weakDimensionSchema],
      default: []
    },
    weakTopics: {
      type: [weakTopicSchema],
      default: []
    },
    recommendations: {
      type: [recommendationSchema],
      default: []
    }
  },
  { timestamps: true }
);

export const UserAnalytics = mongoose.model("UserAnalytics", userAnalyticsSchema);
