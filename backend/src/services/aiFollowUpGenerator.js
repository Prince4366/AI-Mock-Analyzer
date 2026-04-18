import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { withRetry } from "../utils/retry.js";

function buildPrompt({
  rootQuestion,
  previousAnswer,
  conversationHistory,
  level,
  difficulty,
  category
}) {
  return `
You are an interview coach generating one contextual follow-up question.

Rules:
- Output strict JSON only:
{
  "question": "string",
  "intent": "string"
}
- Generate exactly one concise follow-up question.
- The question must directly probe the candidate's previous answer.
- Keep difficulty at ${difficulty} and category aligned with ${category}.
- This is follow-up level ${level} out of max 3.
- Do not include markdown or any extra text.

Root Question:
${rootQuestion}

Candidate Previous Answer:
${previousAnswer}

Conversation History:
${conversationHistory.map((t) => `${t.role}: ${t.text}`).join("\n").slice(0, 2000)}
`;
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  return JSON.parse(cleaned);
}

function isGeminiQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("429") || message.includes("quota") || message.includes("rate limit");
}

async function withOpenAI(prompt) {
  if (!env.openaiApiKey) {
    throw new AppError("OPENAI_API_KEY is not configured", 500);
  }
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: env.openaiModel,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  );
  return response.choices?.[0]?.message?.content || "{}";
}

async function withGroq(prompt) {


  if (!env.groqApiKey) {
    throw new AppError("GROQ_API_KEY is not configured", 500);
  }

  const client = new Groq({ apiKey: env.groqApiKey });

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }]
    })
  );

  return response.choices?.[0]?.message?.content || "{}";
}

async function withGemini(prompt) {
  if (!env.geminiApiKey) {
    throw new AppError("GEMINI_API_KEY is not configured", 500);
  }
  const client = new GoogleGenerativeAI(env.geminiApiKey);
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
      const model = client.getGenerativeModel({ model: modelName });
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

export async function generateFollowUpQuestion(payload) {
  const prompt = buildPrompt(payload);
  let rawText;
  if (env.aiProvider === "gemini") {
    try {
      rawText = await withGemini(prompt);
    } catch (error) {
      if (env.openaiApiKey) {
        rawText = await withOpenAI(prompt);
      } else {
        throw error;
      }
    }
  } else if (env.aiProvider === "groq") {
    try {
      rawText = await withGroq(prompt);
    } catch (error) {
      if (env.openaiApiKey) {
        rawText = await withOpenAI(prompt);
      } else {
        throw error;
      }
    }
  } else {
    rawText = await withOpenAI(prompt);
  }

  let parsed;
  try {
    parsed = parseJson(rawText);
  } catch {
    throw new AppError("Failed to parse follow-up question response", 502);
  }

  const question = String(parsed.question || "").trim();
  if (question.length < 6) {
    throw new AppError("AI returned invalid follow-up question", 502);
  }

  return {
    question,
    intent: String(parsed.intent || "").trim()
  };
}
