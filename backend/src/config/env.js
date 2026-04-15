
import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI", "JWT_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5001,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtCookieExpiresDays: Number(process.env.JWT_COOKIE_EXPIRES_DAYS) || 7,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  aiProvider: process.env.AI_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
};
