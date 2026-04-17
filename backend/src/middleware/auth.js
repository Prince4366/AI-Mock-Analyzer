import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.token;

  if (!token) {
    throw new AppError("Authentication required", 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  req.user = user;
  console.info("[auth.protect] Authenticated request", {
    userId: String(req.user._id),
    email: req.user.email,
    method: req.method,
    path: req.originalUrl
  });
  next();
});
