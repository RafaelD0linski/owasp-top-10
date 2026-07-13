import { Finding, CheckContext, safeFetch } from "../types";

const DEFAULT_CREDS = [
  { username: "admin", password: "admin" },
  { username: "admin", password: "password" },
  { username: "admin", password: "123456" },
];

export async function checkWeakAuth(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Verificando autenticação fraca e ausência de rate limit…");
  const findings: Finding[] = [];

  for (const cred of DEFAULT_CREDS) {
    ctx.log(`Testando credencial padrão ${cred.username}/${cred.password}…`);
    try {
      const res = await safeFetch(ctx, "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cred),
      });
      const text = await res.text();
      const lower = text.toLowerCase();
      if (
        res.ok &&
        (lower.includes("success") ||
          lower.includes("welcome") ||
          lower.includes("token") ||
          lower.includes("authenticated") ||
          lower.includes("dashboard"))
      ) {
        findings.push({
          owaspId: "A07",
          checkId: "weak-auth",
          title: "Credenciais padrão aceitas",
          severity: "critical",
          status: "fail",
          evidence: `POST /login aceitou ${cred.username}/${cred.password}.`,
          risk: "Qualquer pessoa na internet pode entrar com senhas óbvias e obter acesso administrativo. Isso leva a vazamento de dados, alteração de conteúdo, ransomware e uso do servidor como pivot para outros ataques.",
          recommendation:
            "1) Bloqueie senhas comuns (lista deny). 2) Force troca no primeiro acesso. 3) Exija senha forte (comprimento + complexidade ou passphrase). 4) Ative MFA para admins. 5) Remova usuários default de painéis (admin/admin). 6) Monitore logins bem-sucedidos anômalos.",
        });
        break;
      }
    } catch {
      try {
        const res = await safeFetch(ctx, "/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `username=${cred.username}&password=${cred.password}`,
        });
        const text = (await res.text()).toLowerCase();
        if (
          res.ok &&
          (text.includes("success") ||
            text.includes("welcome") ||
            text.includes("authenticated"))
        ) {
          findings.push({
            owaspId: "A07",
            checkId: "weak-auth",
            title: "Credenciais padrão aceitas",
            severity: "critical",
            status: "fail",
            evidence: `POST /login (form) aceitou ${cred.username}/${cred.password}.`,
            risk: "Acesso privilegiado trivial via senha padrão. Compromete toda a confidencialidade e integridade da aplicação.",
            recommendation:
              "Proíba senhas padrão, force troca no primeiro acesso, use MFA e política de senhas fortes.",
          });
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  ctx.log("Enviando rajada de logins inválidos para checar rate limit…");
  let successCount = 0;
  for (let i = 0; i < 12; i++) {
    try {
      const res = await safeFetch(ctx, "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "rate-limit-probe",
          password: `wrong-${i}`,
        }),
      });
      if (res.status !== 429 && res.status !== 503) {
        successCount += 1;
      }
    } catch {
      // ignore
    }
  }

  if (successCount >= 10) {
    findings.push({
      owaspId: "A07",
      checkId: "weak-auth",
      title: "Possível ausência de rate limiting no login",
      severity: "high",
      status: "fail",
      evidence: `${successCount}/12 tentativas inválidas não foram bloqueadas (sem 429/503).`,
      risk: "Sem rate limit, um atacante faz brute force / credential stuffing em massa até acertar senhas. Contas de usuários e admins ficam expostas mesmo com senhas medianas.",
      recommendation:
        "Implemente rate limiting por IP e por conta (ex.: 5 tentativas / 15 min), lockout temporário, CAPTCHA após N falhas e alertas. Em Express: express-rate-limit. Em APIs/gateway: WAF ou middleware do reverse proxy. Responda 429 com Retry-After.",
    });
  } else {
    findings.push({
      owaspId: "A07",
      checkId: "weak-auth",
      title: "Rate limiting aparenta estar presente",
      severity: "info",
      status: "pass",
      evidence: `Apenas ${successCount}/12 tentativas passaram sem bloqueio.`,
      risk: "Controle aparenta mitigar brute force básico.",
      recommendation:
        "Valide limiares em produção e monitore tentativas de autenticação.",
    });
  }

  if (!findings.some((f) => f.title.includes("Credenciais padrão"))) {
    findings.unshift({
      owaspId: "A07",
      checkId: "weak-auth",
      title: "Credenciais padrão não aceitas",
      severity: "info",
      status: "pass",
      evidence:
        "Combinações admin/admin, admin/password e admin/123456 rejeitadas.",
      risk: "Senhas padrão comuns não abriram o login neste teste.",
      recommendation: "Mantenha política de senhas fortes e MFA.",
    });
  }

  return findings;
}
