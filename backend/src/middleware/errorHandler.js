import { env } from "../config/env.js";

function normalizeMongooseError(err) {
  if (err.code === 11000) {
    return { statusCode: 409, message: "Email already exists" };
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((entry) => entry.message)
      .join(", ");
    return { statusCode: 400, message };
  }

  return null;
}

export function errorHandler(err, _req, res, _next) {
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.code === "LIMIT_FILE_SIZE" ? "File too large (max 5MB)" : err.message
    });
  }

  const mongooseError = normalizeMongooseError(err);
  if (mongooseError) {
    return res.status(mongooseError.statusCode).json({
      success: false,
      message: mongooseError.message
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational
    ? err.message
    : "Something went wrong. Please try again later.";

  const payload = {
    success: false,
    message
  };

  if (env.nodeEnv !== "production") {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
}
