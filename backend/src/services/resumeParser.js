import pdfParse from "pdf-parse";

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
  "git",
  "rest",
  "graphql"
];

function normalizeText(text) {
  return text.replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ");
}

function splitLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findSection(lines, headers) {
  const idx = lines.findIndex((line) =>
    headers.some((header) => line.toLowerCase().includes(header))
  );
  if (idx === -1) {
    return [];
  }

  const section = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const value = lines[i];
    const isNewHeading = /^[A-Z][A-Z\s]{2,}$/.test(value);
    if (isNewHeading) {
      break;
    }
    section.push(value.replace(/^[-*]\s*/, ""));
  }
  return section.slice(0, 8);
}

function extractSkills(lines, textLower) {
  const fromSection = findSection(lines, ["skills", "technical skills"]);
  const discovered = new Set(
    SKILL_KEYWORDS.filter((skill) => textLower.includes(skill)).map((skill) =>
      skill.toUpperCase() === skill ? skill : skill.replace(/\b\w/g, (c) => c.toUpperCase())
    )
  );

  fromSection
    .join(",")
    .split(/[,|/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => discovered.add(item));

  return Array.from(discovered).slice(0, 20);
}

function extractProjects(lines) {
  const section = findSection(lines, ["projects", "project experience"]);
  if (section.length > 0) {
    return section;
  }

  return lines
    .filter((line) => /project|built|developed|implemented/i.test(line))
    .slice(0, 6)
    .map((line) => line.replace(/^[-*]\s*/, ""));
}

function extractEducation(lines) {
  const section = findSection(lines, ["education", "academic"]);
  if (section.length > 0) {
    return section;
  }

  return lines
    .filter((line) =>
      /(b\.?tech|m\.?tech|bachelor|master|university|college|school)/i.test(line)
    )
    .slice(0, 5);
}

export async function parseResumePdfBuffer(buffer) {
  const parsed = await pdfParse(buffer);
  const rawText = normalizeText(parsed.text || "");
  const lines = splitLines(rawText);
  const textLower = rawText.toLowerCase();

  return {
    rawText,
    skills: extractSkills(lines, textLower),
    projects: extractProjects(lines),
    education: extractEducation(lines)
  };
}
