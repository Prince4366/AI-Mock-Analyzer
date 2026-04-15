import { Resume } from "../models/Resume.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseResumePdfBuffer } from "../services/resumeParser.js";

export const parseResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("Resume PDF is required", 400);
  }

  const parsed = await parseResumePdfBuffer(req.file.buffer);

  res.status(200).json({
    success: true,
    preview: {
      fileName: req.file.originalname,
      ...parsed
    }
  });
});

export const saveParsedResume = asyncHandler(async (req, res) => {
  const { fileName, rawText, skills, projects, education } = req.body;

  if (!fileName || !rawText) {
    throw new AppError("fileName and rawText are required", 400);
  }

  const resume = await Resume.create({
    userId: req.user._id,
    fileName,
    rawText,
    skills: Array.isArray(skills) ? skills : [],
    projects: Array.isArray(projects) ? projects : [],
    education: Array.isArray(education) ? education : []
  });

  res.status(201).json({
    success: true,
    resume
  });
});

export const listMyResumes = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    resumes
  });
});
