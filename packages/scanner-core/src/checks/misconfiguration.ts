import { Finding, CheckContext, safeFetch } from "../types";

function parseSetCookie(header: string | null): string[] {
  if (!header) return [];
  return header.split(/,(?=[^;]+?=)/).map((c) => c.trim());
}

export async function checkCookieFlags(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Analisando flags de cookies (HttpOnly, Secure, SameSite)…");
  const res = await safeFetch(ctx, "/");
  const findings: Finding[] = [];

  const setCookies =
    typeof (res.headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : parseSetCookie(res.headers.get("set-cookie"));

  if (setCookies.length === 0) {
    ctx.log("Nenhum cookie na home; tentando /login…");
    const loginRes = await safeFetch(ctx, "/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=probe&password=probe",
    });
    const loginCookies =
      typeof (loginRes.headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie === "function"
        ? (
            loginRes.headers as Headers & { getSetCookie: () => string[] }
          ).getSetCookie()
        : parseSetCookie(loginRes.headers.get("set-cookie"));

    if (loginCookies.length === 0) {
      return [
        {
          owaspId: "A05",
          checkId: "cookie-flags",
          title: "Nenhum cookie Set-Cookie detectado",
          severity: "info",
          status: "pass",
          evidence: "Home e /login não retornaram cookies para análise.",
          risk: "Sem cookies de sessão detectados neste probe; se a app usar sessão, valide manualmente as flags.",
          recommendation:
            "Quando houver sessão, configure HttpOnly, Secure (HTTPS) e SameSite=Lax ou Strict.",
        },
      ];
    }

    return analyzeCookies(loginCookies, findings, ctx);
  }

  return analyzeCookies(setCookies, findings, ctx);
}

function analyzeCookies(
  cookies: string[],
  findings: Finding[],
  ctx: CheckContext
): Finding[] {
  for (const cookie of cookies) {
    const name = cookie.split("=")[0] || "cookie";
    const lower = cookie.toLowerCase();
    const missing: string[] = [];

    if (!lower.includes("httponly")) missing.push("HttpOnly");
    if (!lower.includes("secure") && ctx.targetUrl.startsWith("https://")) {
      missing.push("Secure");
    }
    if (!lower.includes("samesite")) missing.push("SameSite");

    if (missing.length > 0) {
      findings.push({
        owaspId: "A05",
        checkId: "cookie-flags",
        title: `Cookie inseguro: ${name}`,
        severity: "medium",
        status: "fail",
        evidence: `Cookie "${name}" sem flags: ${missing.join(", ")}. Valor bruto: ${cookie.slice(0, 120)}`,
        risk: `Cookie de sessão/estado sem ${missing.join(", ")}: XSS pode roubar o cookie (sem HttpOnly), rede pode interceptar (sem Secure) e sites terceiros podem enviar o cookie em requests CSRF (sem SameSite). Impacto típico: sequestro de conta.`,
        recommendation:
          "No Set-Cookie, use: HttpOnly; Secure (em HTTPS); SameSite=Lax (ou Strict). Ex.: Set-Cookie: session=...; Path=/; HttpOnly; Secure; SameSite=Lax. Em Express: cookie: { httpOnly: true, secure: true, sameSite: 'lax' }. Regenere o ID de sessão após login.",
      });
    } else {
      findings.push({
        owaspId: "A05",
        checkId: "cookie-flags",
        title: `Cookie seguro: ${name}`,
        severity: "info",
        status: "pass",
        evidence: cookie.slice(0, 160),
        risk: "Flags básicas presentes. Ainda assim, cookies não devem armazenar dados sensíveis em texto puro.",
        recommendation: "Mantenha as flags e prefira tokens opacos no servidor.",
      });
    }
  }

  return findings;
}

export async function checkVerboseErrors(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Procurando mensagens de erro verbosas / stack traces…");
  const probes = [
    "/this-route-should-not-exist-owasp-probe",
    "/users?id='",
  ];
  const findings: Finding[] = [];
  const markers = [
    "stack trace",
    "traceback",
    "at Object.",
    "SyntaxError",
    "SQLITE_ERROR",
    "sql syntax",
    "mysql",
    "postgresql",
    "Exception",
    "TypeError",
  ];

  for (const path of probes) {
    try {
      const res = await safeFetch(ctx, path);
      const text = (await res.text()).slice(0, 4000).toLowerCase();
      const hit = markers.find((m) => text.includes(m.toLowerCase()));
      if (hit) {
        findings.push({
          owaspId: "A05",
          checkId: "verbose-errors",
          title: "Erro verboso / vazamento de implementação",
          severity: "medium",
          status: "fail",
          evidence: `Em ${path}, resposta contém indício "${hit}".`,
          risk: "Stack traces e erros de SQL revelam caminhos de arquivo, framework, versão de banco e estrutura de queries. Isso facilita ataques direcionados (SQLi, path disclosure) e reduz o tempo de reconhecimento do atacante.",
          recommendation:
            "Em produção: desative debug, retorne mensagens genéricas (ex.: \"Erro interno\") e registre o detalhe só no servidor (logs). Trate 404/500 com páginas neutras. Nunca devolva SQL cru ou Exception.message ao cliente.",
        });
      }
    } catch {
      // ignore
    }
  }

  if (findings.length === 0) {
    findings.push({
      owaspId: "A05",
      checkId: "verbose-errors",
      title: "Sem erros verbosos óbvios",
      severity: "info",
      status: "pass",
      evidence: "Probes não retornaram stack traces ou SQL errors claros.",
      risk: "Nenhum vazamento óbvio encontrado nestes probes.",
      recommendation:
        "Continue evitando detalhes internos em respostas HTTP e monitore logs só no backend.",
    });
  }

  return findings;
}
