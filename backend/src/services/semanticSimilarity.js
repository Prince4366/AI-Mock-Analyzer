import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { withRetry } from "../utils/retry.js";

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(vector) {
  return Math.sqrt(dot(vector, vector));
}

function cosineSimilarity(a, b) {
  const denominator = magnitude(a) * magnitude(b);
  if (!denominator) {
    return 0;
  }
  return dot(a, b) / denominator;
}

function toScoreOutOf10(similarity) {
  const bounded = Math.max(0, Math.min(1, similarity));
  return Number((bounded * 10).toFixed(1));
}

export async function getSemanticSimilarityScore(answerA, answerB) {
  if (!env.openaiApiKey) {
    throw new AppError("OPENAI_API_KEY is required for embedding similarity", 500);
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await withRetry(() =>
    client.embeddings.create({
      model: env.embeddingModel,
      input: [answerA, answerB]
    })
  );

  const vectorA = response.data?.[0]?.embedding;
  const vectorB = response.data?.[1]?.embedding;
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
    throw new AppError("Invalid embedding vectors returned by provider", 502);
  }

  const similarity01 = cosineSimilarity(vectorA, vectorB);
  return {
    similarity01: Number(similarity01.toFixed(4)),
    similarityScore: toScoreOutOf10(similarity01)
  };
}
