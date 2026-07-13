import { normalizeTargetUrl } from "@owasp/scanner-core";

export function getAllowedHosts(): string[] {
  const raw = process.env.ALLOWED_SCAN_HOSTS || "localhost,127.0.0.1";
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export function assertTargetAllowed(url: string) {
  const normalized = normalizeTargetUrl(url);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL inválida");
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = getAllowedHosts();
  if (!allowed.includes(host)) {
    throw new Error(
      `Host não permitido: ${host}. Configure ALLOWED_SCAN_HOSTS ou use o alvo demo.`
    );
  }

  return normalized;
}

export function computeScore(
  findings: { status: string; severity: string }[]
): number {
  let score = 100;
  for (const f of findings) {
    if (f.status !== "fail") continue;
    switch (f.severity) {
      case "critical":
        score -= 25;
        break;
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 8;
        break;
      case "low":
        score -= 3;
        break;
      default:
        score -= 1;
    }
  }
  return Math.max(0, Math.min(100, score));
}

// Simple in-memory rate limit per user
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
