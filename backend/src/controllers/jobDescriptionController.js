import { JobDescription } from "../models/JobDescription.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  extractRawJdText,
  parseJobDescription
} from "../services/jobDescriptionParser.js";

export const parseJd = asyncHandler(async (req, res) => {
  const source = await extractRawJdText({
    bodyText: req.body?.text,
    file: req.file
  });

  if (!source.rawText) {
    throw new AppError("Could not extract text from provided JD", 400);
  }

  const parsed = parseJobDescription(source.rawText);
  res.status(200).json({
    success: true,
    preview: {
      ...source,
      ...parsed
    }
  });
});

export const saveJd = asyncHandler(async (req, res) => {
  const { interviewSessionId, sourceType, fileName, rawText, keywords, skills } = req.body;

  if (!interviewSessionId || !rawText || !sourceType) {
    throw new AppError(
      "interviewSessionId, sourceType, and rawText are required",
      400
    );
  }

  const jd = await JobDescription.create({
    userId: req.user._id,
    interviewSessionId,
    sourceType,
    fileName: fileName || "",
    rawText,
    keywords: Array.isArray(keywords) ? keywords : [],
    skills: Array.isArray(skills) ? skills : []
  });

  res.status(201).json({
    success: true,
    jobDescription: jd
  });
});

export const listJds = asyncHandler(async (req, res) => {
  const jobDescriptions = await JobDescription.find({ userId: req.user._id }).sort({
    createdAt: -1
  });

  res.status(200).json({
    success: true,
    jobDescriptions
  });
});
