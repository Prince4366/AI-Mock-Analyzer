const TOKEN_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "have",
  "explain",
  "describe",
  "would",
  "should",
  "about",
  "into",
  "their",
  "what",
  "when",
  "where"
]);

function avg(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !TOKEN_STOP_WORDS.has(word));
}

function extractTopicKey(question, expectedAnswer) {
  const freq = new Map();
  for (const token of [...tokenize(question), ...tokenize(expectedAnswer)]) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  const top = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([token]) => token);
  return top.length ? top.join(" / ") : "general";
}

function dimensionRecommendations(weakDimensions) {
  const map = {
    relevance: "Practice answering with direct alignment to question intent before adding details.",
    technicalDepth:
      "Strengthen fundamentals and include trade-offs, constraints, and implementation details.",
    communicationClarity:
      "Use structured answers (context, approach, outcome) and avoid long unstructured responses.",
    completeness:
      "Cover problem, approach, result, and impact to avoid partial answers."
  };
  return weakDimensions.map((item) => ({
    area: item.dimension,
    recommendation: map[item.dimension] || "Practice targeted mock answers for this area."
  }));
}

export function buildWeaknessAnalysis(evaluations) {
  const answersAnalyzed = evaluations.length;
  const averageOverallScore = Number(avg(evaluations.map((e) => e.overallScore)).toFixed(2));

  const dimensionValues = {
    relevance: [],
    technicalDepth: [],
    communicationClarity: [],
    completeness: []
  };

  const topicMap = new Map();

  for (const evaluation of evaluations) {
    const s = evaluation.scoreBreakdown || {};
    Object.keys(dimensionValues).forEach((dimension) => {
      const value = Number(s[dimension]);
      if (!Number.isNaN(value)) {
        dimensionValues[dimension].push(value);
      }
    });

    const topic = extractTopicKey(evaluation.question, evaluation.expectedAnswer);
    const topicScores = [
      Number(s.relevance),
      Number(s.technicalDepth),
      Number(s.communicationClarity),
      Number(s.completeness)
    ].filter((v) => !Number.isNaN(v));
    const topicAvg = topicScores.length ? avg(topicScores) : evaluation.overallScore;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, []);
    }
    topicMap.get(topic).push(topicAvg);
  }

  const weakDimensions = Object.entries(dimensionValues)
    .map(([dimension, values]) => ({
      dimension,
      averageScore: Number(avg(values).toFixed(2)),
      sampleSize: values.length
    }))
    .filter((item) => item.sampleSize > 0)
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 4);

  const weakTopics = Array.from(topicMap.entries())
    .map(([topic, scores]) => ({
      topic,
      averageScore: Number(avg(scores).toFixed(2)),
      occurrences: scores.length,
      relatedSkills: topic.split(" / ")
    }))
    .filter((item) => item.occurrences >= 1)
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 8);

  const recommendations = [
    ...dimensionRecommendations(weakDimensions),
    ...weakTopics.slice(0, 3).map((topic) => ({
      area: topic.topic,
      recommendation: `Do focused drills on ${topic.topic} and answer with one real project example plus measurable impact.`
    }))
  ];

  return {
    summary: {
      answersAnalyzed,
      averageOverallScore
    },
    weakDimensions,
    weakTopics,
    recommendations
  };
}
