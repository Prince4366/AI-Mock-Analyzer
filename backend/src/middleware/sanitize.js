const FORBIDDEN_KEYS = new Set(["$where", "$expr", "$regex"]);

function sanitizeString(value) {
  return String(value)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function sanitizeObject(input) {
  if (Array.isArray(input)) {
    return input.map(sanitizeObject);
  }

  if (input && typeof input === "object") {
    return Object.entries(input).reduce((acc, [key, value]) => {
      if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
        return acc;
      }
      acc[key] = sanitizeObject(value);
      return acc;
    }, {});
  }

  if (typeof input === "string") {
    return sanitizeString(input);
  }

  return input;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}
