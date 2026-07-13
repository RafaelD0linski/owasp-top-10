export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "fail" | "pass" | "manual" | "error";
export type CheckMode = "auto" | "assisted";

export interface Finding {
  owaspId: string;
  checkId: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  evidence: string;
  /** O que pode acontecer com a aplicação se isso não for corrigido */
  risk: string;
  /** Passos práticos de correção */
  recommendation: string;
}

export interface CheckContext {
  targetUrl: string;
  fetch: typeof fetch;
  log: (message: string) => void;
  signal?: AbortSignal;
}

export interface SecurityCheck {
  id: string;
  owaspId: string;
  name: string;
  mode: CheckMode;
  description: string;
  run: (ctx: CheckContext) => Promise<Finding[]>;
}

export function normalizeTargetUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed.replace(/\/$/, "");
}

export async function safeFetch(
  ctx: CheckContext,
  pathOrUrl: string,
  init?: RequestInit
): Promise<Response> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${ctx.targetUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  if (ctx.signal) {
    if (ctx.signal.aborted) controller.abort();
    else ctx.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await ctx.fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "OWASP-Scanner-MVP/1.0 (authorized-testing-only)",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
