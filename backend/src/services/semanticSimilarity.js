import OpenAI from "openai";
import { env } from "../config/env.js";
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

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function lexicalSimilarity(answerA, answerB) {
  const tokensA = new Set(tokenize(answerA));
  const tokensB = new Set(tokenize(answerB));
  if (tokensA.size === 0 && tokensB.size === 0) {
    return 0;
  }
  const intersectionCount = [...tokensA].filter((token) => tokensB.has(token)).length;
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export async function getSemanticSimilarityScore(answerA, answerB) {
  if (!env.openaiApiKey) {
    const similarity01 = lexicalSimilarity(answerA, answerB);
    return {
      similarity01: Number(similarity01.toFixed(4)),
      similarityScore: toScoreOutOf10(similarity01)
    };
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
