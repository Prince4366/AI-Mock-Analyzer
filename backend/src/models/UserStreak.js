import mongoose from "mongoose";

const weeklyStatusSchema = new mongoose.Schema(
  {
    weekStart: { type: Date, required: true },
    completedDays: { type: Number, default: 0 },
    targetDays: { type: Number, default: 3 },
    achieved: { type: Boolean, default: false }
  },
  { _id: false }
);

const recentDaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    completed: { type: Boolean, required: true }
  },
  { _id: false }
);

const userStreakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    currentDailyStreak: { type: Number, default: 0 },
    longestDailyStreak: { type: Number, default: 0 },
    currentWeeklyStreak: { type: Number, default: 0 },
    longestWeeklyStreak: { type: Number, default: 0 },
    lastCompletionDate: { type: Date, default: null },
    weeklyStatus: { type: weeklyStatusSchema, default: null },
    recent7Days: { type: [recentDaySchema], default: [] }
  },
  { timestamps: true }
);

export const UserStreak = mongoose.model("UserStreak", userStreakSchema);
