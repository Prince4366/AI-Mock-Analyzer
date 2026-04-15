import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: "🏅" },
    milestoneType: { type: String, required: true },
    milestoneValue: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Badge = mongoose.model("Badge", badgeSchema);
