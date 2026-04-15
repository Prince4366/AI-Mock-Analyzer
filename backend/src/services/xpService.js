import { AnswerEvaluation } from "../models/AnswerEvaluation.js";
import { UserProgress } from "../models/UserProgress.js";

function getXpForLevel(level) {
  return 100 + (level - 1) * 50;
}

function calculateLevelProgress(totalXp) {
  let level = 1;
  let remaining = totalXp;
  let needed = getXpForLevel(level);

  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = getXpForLevel(level);
  }

  return {
    level,
    xpIntoCurrentLevel: remaining,
    xpForNextLevel: needed
  };
}

export function calculateInterviewXp(avgScore, evaluatedAnswersCount) {
  const base = 50;
  const scoreBonus = Math.round((Number(avgScore) || 0) * 5);
  const answerBonus = Math.min(40, (Number(evaluatedAnswersCount) || 0) * 2);
  return Math.max(20, base + scoreBonus + answerBonus);
}

async function getOrCreateProgress(userId) {
  let progress = await UserProgress.findOne({ userId });
  if (!progress) {
    progress = await UserProgress.create({ userId });
  }
  return progress;
}

export async function awardXpForCompletedInterview(userId, sessionId) {
  const evaluations = await AnswerEvaluation.find({ userId, sessionId }).select("overallScore");
  const avgScore =
    evaluations.length > 0
      ? evaluations.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) /
        evaluations.length
      : 0;

  const gainedXp = calculateInterviewXp(avgScore, evaluations.length);
  const progress = await getOrCreateProgress(userId);
  const previousLevel = progress.level;

  const newTotal = progress.totalXp + gainedXp;
  const calculated = calculateLevelProgress(newTotal);

  progress.totalXp = newTotal;
  progress.level = calculated.level;
  progress.xpIntoCurrentLevel = calculated.xpIntoCurrentLevel;
  progress.xpForNextLevel = calculated.xpForNextLevel;
  await progress.save();

  return {
    gainedXp,
    leveledUp: progress.level > previousLevel,
    ...calculated,
    totalXp: progress.totalXp
  };
}

export async function getUserProgress(userId) {
  const progress = await getOrCreateProgress(userId);
  const calculated = calculateLevelProgress(progress.totalXp);

  if (
    progress.level !== calculated.level ||
    progress.xpIntoCurrentLevel !== calculated.xpIntoCurrentLevel ||
    progress.xpForNextLevel !== calculated.xpForNextLevel
  ) {
    progress.level = calculated.level;
    progress.xpIntoCurrentLevel = calculated.xpIntoCurrentLevel;
    progress.xpForNextLevel = calculated.xpForNextLevel;
    await progress.save();
  }

  return progress;
}
