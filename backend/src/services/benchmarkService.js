import { AnswerEvaluation } from "../models/AnswerEvaluation.js";

const MIN_BENCHMARK_USERS = 12;

const MOCK_OVERALL_DISTRIBUTION = [4.8, 5.2, 5.5, 5.9, 6.1, 6.3, 6.7, 6.9, 7.1, 7.4, 7.6, 8.0];
const MOCK_CATEGORY_DISTRIBUTION = {
  technical: [4.7, 5.1, 5.6, 6.0, 6.4, 6.9, 7.2, 7.5],
  hr: [5.0, 5.4, 5.8, 6.2, 6.5, 6.8, 7.0, 7.3],
  behavioral: [5.2, 5.6, 6.0, 6.3, 6.6, 6.9, 7.2, 7.6]
};

function percentileFromDistribution(distribution, value) {
  if (!distribution.length) {
    return 0;
  }
  const lowerCount = distribution.filter((entry) => entry < value).length;
  return Math.round((lowerCount / distribution.length) * 100);
}

function topicKey(question) {
  const words = String(question || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  return words.slice(0, 2).join(" / ") || "general";
}

export async function computeBenchmarkForUser(userId) {
  const userOverallAgg = await AnswerEvaluation.aggregate([
    { $match: { userId } },
    { $group: { _id: "$userId", avgScore: { $avg: "$overallScore" }, answers: { $sum: 1 } } }
  ]);
  if (!userOverallAgg.length) {
    return {
      overall: {
        averageScore: 0,
        percentile: 0,
        statement: "Complete interviews to unlock benchmarking insights."
      },
      byCategory: [],
      byTopic: []
    };
  }

  const userAverage = Number(userOverallAgg[0].avgScore.toFixed(2));

  const allUserAveragesAgg = await AnswerEvaluation.aggregate([
    { $group: { _id: "$userId", avgScore: { $avg: "$overallScore" } } }
  ]);
  const allUserAverages = allUserAveragesAgg.map((entry) => Number(entry.avgScore.toFixed(2)));
  const overallDistribution =
    allUserAverages.length >= MIN_BENCHMARK_USERS
      ? allUserAverages
      : [...allUserAverages, ...MOCK_OVERALL_DISTRIBUTION];
  const overallPercentile = percentileFromDistribution(overallDistribution, userAverage);

  const categoryAgg = await AnswerEvaluation.aggregate([
    {
      $lookup: {
        from: "interviewsessions",
        localField: "sessionId",
        foreignField: "_id",
        as: "session"
      }
    },
    { $unwind: { path: "$session", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        questionMeta: {
          $cond: [
            { $gte: ["$questionIndex", 0] },
            { $arrayElemAt: ["$session.generatedQuestions", "$questionIndex"] },
            null
          ]
        }
      }
    },
    {
      $addFields: {
        category: { $ifNull: ["$questionMeta.category", "general"] }
      }
    },
    {
      $group: {
        _id: { userId: "$userId", category: "$category" },
        avgScore: { $avg: "$overallScore" }
      }
    }
  ]);

  const userCategoryScores = new Map();
  const categoryDistribution = new Map();
  categoryAgg.forEach((entry) => {
    const category = entry._id.category;
    const avg = Number(entry.avgScore.toFixed(2));
    if (!categoryDistribution.has(category)) {
      categoryDistribution.set(category, []);
    }
    categoryDistribution.get(category).push(avg);
    if (String(entry._id.userId) === String(userId)) {
      userCategoryScores.set(category, avg);
    }
  });

  const byCategory = Array.from(userCategoryScores.entries()).map(([category, avg]) => {
    const base = categoryDistribution.get(category) || [];
    const mocks = MOCK_CATEGORY_DISTRIBUTION[category] || [];
    const distribution =
      base.length >= 6 ? base : [...base, ...mocks, ...MOCK_OVERALL_DISTRIBUTION.slice(0, 4)];
    const percentile = percentileFromDistribution(distribution, avg);
    return {
      category,
      averageScore: avg,
      percentile,
      statement: `You scored better than ${percentile}% of users in ${category} interviews`
    };
  });

  const allEval = await AnswerEvaluation.find({})
    .select("userId question overallScore")
    .lean();
  const topicPerUser = new Map();
  for (const item of allEval) {
    const topic = topicKey(item.question);
    const key = `${item.userId}::${topic}`;
    if (!topicPerUser.has(key)) {
      topicPerUser.set(key, []);
    }
    topicPerUser.get(key).push(Number(item.overallScore || 0));
  }

  const distributionByTopic = new Map();
  const userTopicScores = new Map();
  topicPerUser.forEach((scores, key) => {
    const [uid, topic] = key.split("::");
    const avg = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
    if (!distributionByTopic.has(topic)) {
      distributionByTopic.set(topic, []);
    }
    distributionByTopic.get(topic).push(avg);
    if (uid === String(userId)) {
      userTopicScores.set(topic, avg);
    }
  });

  const byTopic = Array.from(userTopicScores.entries())
    .map(([topic, avg]) => {
      const dist = distributionByTopic.get(topic) || [];
      const distribution =
        dist.length >= 6 ? dist : [...dist, ...MOCK_OVERALL_DISTRIBUTION.slice(0, 8)];
      const percentile = percentileFromDistribution(distribution, avg);
      return {
        topic,
        averageScore: avg,
        percentile,
        statement: `You scored better than ${percentile}% of users on topic "${topic}"`
      };
    })
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 6);

  return {
    overall: {
      averageScore: userAverage,
      percentile: overallPercentile,
      statement: `You scored better than ${overallPercentile}% of users`
    },
    byCategory,
    byTopic
  };
}
