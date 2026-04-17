import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { sanitizeRequest } from "./middleware/sanitize.js";

export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://ai-mock-analyzer.vercel.app"
];

app.use(cors({
  origin: true,
  credentials: true
}));

app.options("*", cors());

app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(apiRateLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(sanitizeRequest);

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);
