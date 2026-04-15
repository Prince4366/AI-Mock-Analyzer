import { AppError } from "./AppError.js";

const RETRYABLE_PATTERNS = [
  /rate limit/i,
  /429/,
  /timeout/i,
  /temporar/i,
  /overloaded/i,
  /unavailable/i
];

function isRetryableError(error) {
  const message = String(error?.message || "");
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
}

export async function withRetry(task, options = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) {
        break;
      }
      const waitMs = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new AppError(
    `AI provider request failed after retries: ${lastError?.message || "unknown error"}`,
    502
  );
}
