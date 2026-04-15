import multer from "multer";
import { AppError } from "../utils/AppError.js";

const storage = multer.memoryStorage();

function pdfFilter(_req, file, cb) {
  if (file.mimetype !== "application/pdf") {
    cb(new AppError("Only PDF files are allowed", 400));
    return;
  }
  cb(null, true);
}

export const uploadResumePdf = multer({
  storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).single("resume");

function jdFileFilter(_req, file, cb) {
  const allowed = ["application/pdf", "text/plain"];
  if (!allowed.includes(file.mimetype)) {
    cb(new AppError("JD file must be PDF or TXT", 400));
    return;
  }
  cb(null, true);
}

export const uploadJdFile = multer({
  storage,
  fileFilter: jdFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).single("jdFile");
