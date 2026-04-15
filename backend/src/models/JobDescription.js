import mongoose from "mongoose";

const jobDescriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    interviewSessionId: {
      type: String,
      required: true,
      trim: true
    },
    sourceType: {
      type: String,
      enum: ["text", "file"],
      required: true
    },
    fileName: {
      type: String,
      default: ""
    },
    rawText: {
      type: String,
      required: true
    },
    keywords: {
      type: [String],
      default: []
    },
    skills: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);
