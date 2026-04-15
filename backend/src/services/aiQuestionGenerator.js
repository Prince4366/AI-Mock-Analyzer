import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { withRetry } from "../utils/retry.js";

const ROLE_PROMPT_GUIDANCE = {
  "Software Engineer":
    "Focus on backend/frontend architecture, data structures, debugging, scalability, and system design trade-offs.",
  "Data Analyst":
    "Focus on SQL analytics, dashboard metrics, hypothesis testing, data storytelling, and business insight extraction.",
  "AIML Engineer":
    "Focus on ML modeling, feature engineering, model evaluation, deployment, drift monitoring, and MLOps decisions.",
  "Product Manager":
    "Focus on product sense, prioritization frameworks, stakeholder management, execution planning, and impact metrics.",
  "HR/Behavioral":
    "Focus on communication, collaboration, conflict handling, ownership, leadership examples, and values alignment."
};

function buildPrompt({
  resume,
  jobDescription,
  difficulty,
  questionCount,
  adaptiveContext,
  roleTrack
}) {
  return `
You are an interview expert. Generate personalized interview questions using the candidate profile and job description.

Rules:
- Output strictly JSON with this shape:
{
  "questions": [
    {
      "category": "technical|hr|behavioral",
      "difficulty": "Easy|Medium|Hard|Expert",
      "question": "string"
    }
  ]
}
- Include all three categories: technical, hr, behavioral.
- Create exactly ${questionCount} total questions.
- Set difficulty to ${difficulty} for all questions.
- If adaptive context is provided, align challenge to it.
- Role track: ${roleTrack}
- Questions must be concrete, role-specific, and non-generic.
- Do not add markdown/code-fences or extra text.

Candidate Resume Signals:
- Skills: ${(resume.skills || []).join(", ") || "N/A"}
- Projects: ${(resume.projects || []).join(" | ") || "N/A"}
- Education: ${(resume.education || []).join(" | ") || "N/A"}
- Resume Text Snippet: ${(resume.rawText || "").slice(0, 1800)}

Job Description Signals:
- Skills Required: ${(jobDescription.skills || []).join(", ") || "N/A"}
- Keywords: ${(jobDescription.keywords || []).join(", ") || "N/A"}
- JD Text Snippet: ${(jobDescription.rawText || "").slice(0, 1800)}

Adaptive Context:
${adaptiveContext || "No adaptive context provided"}

Role-Specific Interview Guidance:
${ROLE_PROMPT_GUIDANCE[roleTrack] || ROLE_PROMPT_GUIDANCE["Software Engineer"]}
`;
}

function parseModelJson(text) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Model response missing questions array");
  }
  return parsed;
}

function normalizeQuestions(rawQuestions, fallbackDifficulty) {
  const allowedCategory = new Set(["technical", "hr", "behavioral"]);
  const allowedDifficulty = new Set(["Easy", "Medium", "Hard", "Expert"]);

  const normalized = rawQuestions
    .map((item) => ({
      category: String(item.category || "").toLowerCase(),
      difficulty: String(item.difficulty || fallbackDifficulty),
      question: String(item.question || "").trim()
    }))
    .filter((item) => allowedCategory.has(item.category) && item.question.length > 5)
    .map((item) => ({
      ...item,
      difficulty: allowedDifficulty.has(item.difficulty) ? item.difficulty : fallbackDifficulty
    }));

  if (normalized.length === 0) {
    throw new AppError("AI returned invalid questions format", 502);
  }
  return normalized;
}

function isGeminiQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("429") || message.includes("quota") || message.includes("rate limit");
}

async function generateWithOpenAI(prompt) {
  if (!env.openaiApiKey) {
    throw new AppError("OPENAI_API_KEY is not configured", 500);
  }
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: env.openaiModel,
      temperature: 0.5,
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
      temperature: 0.5,
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

export async function generateInterviewQuestions({
  resume,
  jobDescription,
  difficulty,
  questionCount,
  adaptiveContext = "",
  roleTrack = "Software Engineer"
}) {
  const prompt = buildPrompt({
    resume,
    jobDescription,
    difficulty,
    questionCount,
    adaptiveContext,
    roleTrack
  });
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
    throw new AppError("Failed to parse AI response as JSON", 502);
  }

  return normalizeQuestions(parsed.questions, difficulty).slice(0, questionCount);
}
