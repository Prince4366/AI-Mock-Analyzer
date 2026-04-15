import { Badge } from "../models/Badge.js";
import { UserBadge } from "../models/UserBadge.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { AnswerEvaluation } from "../models/AnswerEvaluation.js";
import { UserStreak } from "../models/UserStreak.js";

const DEFAULT_BADGES = [
  {
    key: "first_interview_completed",
    title: "First Interview Completed",
    description: "Completed your first mock interview session.",
    icon: "🚀",
    milestoneType: "completed_interviews",
    milestoneValue: 1
  },
  {
    key: "five_interview_streak",
    title: "5 Interview Streak",
    description: "Maintained a 5-day interview streak.",
    icon: "🔥",
    milestoneType: "daily_streak",
    milestoneValue: 5
  },
  {
    key: "ten_perfect_answers",
    title: "10 Perfect Answers",
    description: "Scored 10 perfect answers.",
    icon: "💯",
    milestoneType: "perfect_answers",
    milestoneValue: 10
  },
  {
    key: "hundred_questions_answered",
    title: "100 Questions Answered",
    description: "Submitted 100 evaluated interview answers.",
    icon: "🧠",
    milestoneType: "questions_answered",
    milestoneValue: 100
  }
];

export async function ensureDefaultBadges() {
  await Promise.all(
    DEFAULT_BADGES.map((badge) =>
      Badge.updateOne({ key: badge.key }, { $setOnInsert: badge }, { upsert: true })
    )
  );
}

async function getUserBadgeMetrics(userId) {
  const [completedInterviews, totalEvaluations, perfectAnswers, streak] = await Promise.all([
    InterviewSession.countDocuments({ userId, status: "completed" }),
    AnswerEvaluation.countDocuments({ userId }),
    AnswerEvaluation.countDocuments({ userId, overallScore: { $gte: 9.95 } }),
    UserStreak.findOne({ userId })
  ]);

  return {
    completed_interviews: completedInterviews,
    questions_answered: totalEvaluations,
    perfect_answers: perfectAnswers,
    daily_streak: streak?.currentDailyStreak || 0
  };
}

export async function autoAwardBadgesForUser(userId) {
  const [allBadges, earned, metrics] = await Promise.all([
    Badge.find({}),
    UserBadge.find({ userId }).select("badgeKey"),
    getUserBadgeMetrics(userId)
  ]);

  const earnedKeys = new Set(earned.map((item) => item.badgeKey));
  const toAward = allBadges.filter((badge) => {
    if (earnedKeys.has(badge.key)) {
      return false;
    }
    const value = metrics[badge.milestoneType] || 0;
    return value >= badge.milestoneValue;
  });

  if (toAward.length === 0) {
    return [];
  }

  const awardedAt = new Date();
  await UserBadge.insertMany(
    toAward.map((badge) => ({
      userId,
      badgeKey: badge.key,
      awardedAt
    }))
  );

  return toAward.map((badge) => ({
    key: badge.key,
    title: badge.title,
    description: badge.description,
    icon: badge.icon,
    awardedAt
  }));
}

export async function getUserBadgeShowcase(userId) {
  const [badgeMeta, userBadges] = await Promise.all([
    Badge.find({}),
    UserBadge.find({ userId }).sort({ awardedAt: -1 })
  ]);

  const userMap = new Map(userBadges.map((item) => [item.badgeKey, item]));
  const showcase = badgeMeta.map((badge) => ({
    key: badge.key,
    title: badge.title,
    description: badge.description,
    icon: badge.icon,
    unlocked: userMap.has(badge.key),
    awardedAt: userMap.get(badge.key)?.awardedAt || null
  }));

  const recentUnlocks = showcase
    .filter((badge) => badge.unlocked && badge.awardedAt)
    .filter((badge) => Date.now() - new Date(badge.awardedAt).getTime() <= 24 * 60 * 60 * 1000)
    .slice(0, 3);

  return { showcase, recentUnlocks };
}
