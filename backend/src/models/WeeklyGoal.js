import mongoose from "mongoose";

const weeklyGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    weekStart: {
      type: Date,
      required: true,
      index: true
    },
    targetInterviews: {
      type: Number,
      required: true,
      min: 1,
      max: 50
    },
    completedInterviews: {
      type: Number,
      default: 0
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

weeklyGoalSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export const WeeklyGoal = mongoose.model("WeeklyGoal", weeklyGoalSchema);
