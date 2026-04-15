import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true
    },
    rawText: {
      type: String,
      required: true
    },
    skills: {
      type: [String],
      default: []
    },
    projects: {
      type: [String],
      default: []
    },
    education: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Resume = mongoose.model("Resume", resumeSchema);
