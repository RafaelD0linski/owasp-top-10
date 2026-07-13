import { Finding, CheckContext, safeFetch } from "../types";

const REQUIRED_HEADERS = [
  {
    name: "content-security-policy",
    label: "Content-Security-Policy",
    severity: "high" as const,
    risk: "Sem CSP, um XSS bem-sucedido consegue carregar scripts externos, roubar sessão e defacear a página com mais facilidade. Aumenta o impacto de qualquer falha de injeção no frontend.",
    recommendation:
      "Configure o header Content-Security-Policy no servidor/proxy. Comece com: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'. Evite 'unsafe-inline'/'unsafe-eval'. No Nginx: add_header Content-Security-Policy \"...\" always; No Express: use helmet.contentSecurityPolicy().",
  },
  {
    name: "x-frame-options",
    label: "X-Frame-Options",
    severity: "medium" as const,
    risk: "A aplicação pode ser embutida em um iframe malicioso (clickjacking). O usuário clica achando que está na sua UI, mas dispara ações no site real (transferência, troca de email, etc.).",
    recommendation:
      "Envie X-Frame-Options: DENY (ou SAMEORIGIN se precisar de iframes internos). Alternativa moderna: Content-Security-Policy com frame-ancestors 'none' ou 'self'. No Express: helmet.frameguard({ action: 'deny' }).",
  },
  {
    name: "x-content-type-options",
    label: "X-Content-Type-Options",
    severity: "low" as const,
    risk: "O navegador pode 'adivinhar' o tipo do arquivo (MIME sniffing) e executar conteúdo como script/HTML mesmo quando o servidor não pretendia isso — útil em ataques de upload/conteúdo controlado.",
    recommendation:
      "Adicione sempre o header X-Content-Type-Options: nosniff nas respostas. Garanta também Content-Type correto em downloads e uploads.",
  },
  {
    name: "referrer-policy",
    label: "Referrer-Policy",
    severity: "low" as const,
    risk: "URLs sensíveis (tokens em query string, IDs internos) podem vazar para sites de terceiros via cabeçalho Referer, facilitando vazamento de dados e rastreamento.",
    recommendation:
      "Defina Referrer-Policy: strict-origin-when-cross-origin (bom padrão) ou no-referrer em páginas muito sensíveis. Remova segredos da URL; use body/headers.",
  },
  {
    name: "strict-transport-security",
    label: "Strict-Transport-Security",
    severity: "medium" as const,
    risk: "Sem HSTS, um atacante em rede (Wi‑Fi pública, DNS spoofing) pode forçar o usuário a HTTP e interceptar cookies/credenciais (SSL stripping).",
    recommendation:
      "Após habilitar HTTPS de ponta a ponta, envie Strict-Transport-Security: max-age=31536000; includeSubDomains. Só ative preload depois de validar todos os subdomínios em HTTPS.",
  },
];

export async function checkSecurityHeaders(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Buscando página inicial e inspecionando headers de segurança…");
  const res = await safeFetch(ctx, "/");
  const findings: Finding[] = [];

  for (const header of REQUIRED_HEADERS) {
    const value = res.headers.get(header.name);
    if (!value) {
      if (
        header.name === "strict-transport-security" &&
        !ctx.targetUrl.startsWith("https://")
      ) {
        findings.push({
          owaspId: "A05",
          checkId: "security-headers",
          title: `${header.label} ausente (HTTP)`,
          severity: "info",
          status: "pass",
          evidence:
            "Alvo em HTTP; HSTS só se aplica após migração para HTTPS.",
          risk: "Nenhum risco adicional neste momento: HSTS só faz sentido depois que o site estiver 100% em HTTPS.",
          recommendation: header.recommendation,
        });
        continue;
      }

      findings.push({
        owaspId: "A05",
        checkId: "security-headers",
        title: `Header ausente: ${header.label}`,
        severity: header.severity,
        status: "fail",
        evidence: `Resposta ${res.status} sem o header ${header.label}.`,
        risk: header.risk,
        recommendation: header.recommendation,
      });
    } else {
      ctx.log(`Header ${header.label} presente.`);
      findings.push({
        owaspId: "A05",
        checkId: "security-headers",
        title: `Header presente: ${header.label}`,
        severity: "info",
        status: "pass",
        evidence: `${header.label}: ${value}`,
        risk: "Controle presente. Revise periodicamente se a política ainda está adequada ao frontend.",
        recommendation:
          "Mantenha o header e teste após deploys (regressões em reverse proxy são comuns).",
      });
    }
  }

  return findings;
}
