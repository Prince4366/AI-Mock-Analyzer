import pdfParse from "pdf-parse";
import { AppError } from "../utils/AppError.js";

const COMMON_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "are",
  "our",
  "that",
  "will",
  "this",
  "from",
  "have",
  "years",
  "experience",
  "job",
  "role",
  "team"
]);

const SKILL_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "node.js",
  "node",
  "express",
  "mongodb",
  "python",
  "java",
  "sql",
  "aws",
  "docker",
  "kubernetes",
  "system design",
  "microservices",
  "graphql",
  "rest api",
  "redis",
  "ci/cd"
];

function normalizeText(text) {
  return text.replace(/\r/g, "").replace(/[ ]{2,}/g, " ").trim();
}

function unique(array) {
  return Array.from(new Set(array));
}

function extractSkills(rawText) {
  const lower = rawText.toLowerCase();
  return SKILL_KEYWORDS.filter((skill) => lower.includes(skill));
}

function extractKeywords(rawText) {
  const tokens = rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !COMMON_STOP_WORDS.has(word));

  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);
}

export async function extractRawJdText({ bodyText, file }) {
  if (bodyText && bodyText.trim()) {
    return { sourceType: "text", fileName: "", rawText: normalizeText(bodyText) };
  }

  if (!file) {
    throw new AppError("Provide either JD text or a file upload", 400);
  }

  if (file.mimetype === "application/pdf") {
    const parsed = await pdfParse(file.buffer);
    return {
      sourceType: "file",
      fileName: file.originalname,
      rawText: normalizeText(parsed.text || "")
    };
  }

  if (file.mimetype === "text/plain") {
    return {
      sourceType: "file",
      fileName: file.originalname,
      rawText: normalizeText(file.buffer.toString("utf8"))
    };
  }

  throw new AppError("Unsupported file type. Upload PDF or TXT", 400);
}

export function parseJobDescription(rawText) {
  const skills = unique(extractSkills(rawText)).slice(0, 20);
  const keywords = unique(extractKeywords(rawText)).slice(0, 25);
  return { skills, keywords };
}
