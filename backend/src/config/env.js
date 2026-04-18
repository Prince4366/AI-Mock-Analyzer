import dotenv from "dotenv";

dotenv.config();

// ✅ Required variables (fail fast)
const required = [
  "MONGODB_URI",
  "JWT_SECRET",
  "AI_PROVIDER" // ensure provider is always defined
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// ✅ Normalize provider
const aiProvider = process.env.AI_PROVIDER.toLowerCase();

// ✅ Validate provider-specific API keys
if (aiProvider === "groq" && !process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is required when AI_PROVIDER=groq");
}

if (aiProvider === "openai" && !process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
}

if (aiProvider === "gemini" && !process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
}

// ✅ Export config
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5001,

  mongodbUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtCookieExpiresDays: Number(process.env.JWT_COOKIE_EXPIRES_DAYS) || 7,

  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  // 🔥 AI CONFIG
  aiProvider,

  groqApiKey: process.env.GROQ_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",

  // Models
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",

  embeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
};