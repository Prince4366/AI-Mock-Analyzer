import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { getSemanticSimilarityScore } from "./semanticSimilarity.js";
import { withRetry } from "../utils/retry.js";

function buildPrompt({ question, expectedAnswer, userAnswer }) {
  return `
Evaluate the interview answer against the question and expected answer.

Return strict JSON only using this schema:
{
  "scores": {
    "relevance": 0-10 number,
    "technicalDepth": 0-10 number,
    "communicationClarity": 0-10 number,
    "completeness": 0-10 number
  },
  "overallScore": 0-10 number,
  "feedback": {
    "strengths": ["string", "..."],
    "improvements": ["string", "..."],
    "summary": "string"
  }
}

Rules:
- Be strict and objective.
- Use only the provided content.
- Do not include markdown/code fences.
- Keep strengths and improvements concise and actionable.

Question:
${question}

Expected Answer:
${expectedAnswer}

User Answer:
${userAnswer}
`;
}

function parseModelJson(text) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  return JSON.parse(cleaned);
}

function clamp10(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(10, Number(parsed.toFixed(1))));
}

function isGeminiQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("429") || message.includes("quota") || message.includes("rate limit");
}

function normalizeEvaluation(raw) {
  if (!raw || typeof raw !== "object" || !raw.scores || !raw.feedback) {
    throw new AppError("AI returned invalid evaluation format", 502);
  }

  const scoreBreakdown = {
    relevance: clamp10(raw.scores.relevance),
    technicalDepth: clamp10(raw.scores.technicalDepth),
    communicationClarity: clamp10(raw.scores.communicationClarity),
    completeness: clamp10(raw.scores.completeness)
  };

  const computedAverage =
    (scoreBreakdown.relevance +
      scoreBreakdown.technicalDepth +
      scoreBreakdown.communicationClarity +
      scoreBreakdown.completeness) /
    4;

  const overallScore = raw.overallScore ? clamp10(raw.overallScore) : clamp10(computedAverage);

  return {
    scoreBreakdown,
    overallScore,
    feedback: {
      strengths: Array.isArray(raw.feedback.strengths) ? raw.feedback.strengths.slice(0, 6) : [],
      improvements: Array.isArray(raw.feedback.improvements)
        ? raw.feedback.improvements.slice(0, 6)
        : [],
      summary: String(raw.feedback.summary || "").trim()
    }
  };
}

async function generateWithOpenAI(prompt) {
  if (!env.openaiApiKey) {
    throw new AppError("OPENAI_API_KEY is not configured", 500);
  }
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: env.openaiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  );
  return response.choices?.[0]?.message?.content || "{}";
}

async function generateWithGroq(prompt) {
  if (!env.groqApiKey) {
    throw new AppError("GROQ_API_KEY is not configured", 500);
  }
  const client = new Groq({ apiKey: env.groqApiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  );
  return response.choices?.[0]?.message?.content || "{}";
}

async function generateWithGemini(prompt) {
  if (!env.geminiApiKey) {
    throw new AppError("GEMINI_API_KEY is not configured", 500);
  }
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const candidateModels = [
    env.geminiModel,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest"
  ].filter(Boolean);
  let lastError;

  for (const modelName of [...new Set(candidateModels)]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await withRetry(() => model.generateContent(prompt));
      return result.response.text();
    } catch (error) {
      lastError = error;
    }
  }

  if (isGeminiQuotaError(lastError)) {
    throw new AppError(
      "Gemini quota exceeded. Retry later or set OPENAI_API_KEY for automatic fallback.",
      429
    );
  }
  throw lastError;
}

export async function evaluateInterviewAnswer({ question, expectedAnswer, userAnswer }) {
  const prompt = buildPrompt({ question, expectedAnswer, userAnswer });
  let rawText;
  if (env.aiProvider === "gemini") {
    try {
      rawText = await generateWithGemini(prompt);
    } catch (error) {
      if (env.openaiApiKey) {
        rawText = await generateWithOpenAI(prompt);
      } else {
        throw error;
      }
    }
  } else if (env.aiProvider === "groq") {
    try {
      rawText = await generateWithGroq(prompt);
    } catch (error) {
      if (env.openaiApiKey) {
        rawText = await generateWithOpenAI(prompt);
      } else {
        throw error;
      }
    }
  } else {
    rawText = await generateWithOpenAI(prompt);
  }

  let parsed;
  try {
    parsed = parseModelJson(rawText);
  } catch {
    throw new AppError("Failed to parse AI evaluation response", 502);
  }

  const normalized = normalizeEvaluation(parsed);
  const semantic = await getSemanticSimilarityScore(expectedAnswer, userAnswer);

  // Final score blends rubric quality + semantic alignment:
  // - 70% from LLM rubric score (communication, depth, relevance, completeness)
  // - 30% from embedding cosine similarity (answer meaning vs ideal answer)
  // This reduces over-reliance on stylistic fluency and rewards factual closeness.
  const llmScore = normalized.overallScore;
  const finalScore = Number((llmScore * 0.7 + semantic.similarityScore * 0.3).toFixed(1));

  return {
    ...normalized,
    llmScore,
    semanticSimilarity: semantic.similarity01,
    semanticSimilarityScore: semantic.similarityScore,
    overallScore: finalScore
  };
}
