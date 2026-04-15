import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: env.jwtCookieExpiresDays * 24 * 60 * 60 * 1000
  });
}

function sendAuthResponse(res, statusCode, user, token) {
  setAuthCookie(res, token);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    }
  });
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("Email already in use", 409);
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id.toString());

  sendAuthResponse(res, 201, user, token);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = signToken(user._id.toString());
  sendAuthResponse(res, 200, user, token);
});

export const logout = asyncHandler(async (_req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    expires: new Date(0)
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

export const me = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    }
  });
});
