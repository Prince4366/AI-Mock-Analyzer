import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    totalXp: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    xpIntoCurrentLevel: {
      type: Number,
      default: 0
    },
    xpForNextLevel: {
      type: Number,
      default: 100
    }
  },
  { timestamps: true }
);

export const UserProgress = mongoose.model("UserProgress", userProgressSchema);
