import mongoose from "mongoose";

const userBadgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    badgeKey: {
      type: String,
      required: true,
      index: true
    },
    awardedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

userBadgeSchema.index({ userId: 1, badgeKey: 1 }, { unique: true });

export const UserBadge = mongoose.model("UserBadge", userBadgeSchema);
