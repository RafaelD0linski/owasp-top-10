import { Finding, CheckContext, safeFetch } from "../types";

const XSS_PAYLOAD = `<owasp-xss-probe-${Date.now()}>`;

export async function checkReflectedXss(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Testando XSS refletido com payload de probe seguro…");
  const paths = [
    `/search?q=${encodeURIComponent(XSS_PAYLOAD)}`,
    `/?q=${encodeURIComponent(XSS_PAYLOAD)}`,
    `/reflect?input=${encodeURIComponent(XSS_PAYLOAD)}`,
  ];

  for (const path of paths) {
    try {
      const res = await safeFetch(ctx, path);
      const text = await res.text();
      if (text.includes(XSS_PAYLOAD)) {
        ctx.log(`XSS refletido detectado em ${path}`);
        return [
          {
            owaspId: "A03",
            checkId: "reflected-xss",
            title: "XSS refletido detectado",
            severity: "high",
            status: "fail",
            evidence: `Payload refletido sem encoding em ${path}.`,
            risk: "Um atacante pode enviar um link malicioso que executa JavaScript no navegador da vítima autenticada. Impactos: roubo de sessão/cookies, keylogging, redirecionamento para phishing, alteração da UI e ações em nome do usuário.",
            recommendation:
              "Nunca concatenar input do usuário no HTML. Faça encoding contextual (ex.: escapeHtml no servidor ou frameworks que escapam por padrão — React/Vue). Para HTML rico, use sanitizer (DOMPurify). Adicione CSP restritiva. Ex. Node: const safe = input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');",
          },
        ];
      }
      ctx.log(`Sem reflexão insegura em ${path}`);
    } catch {
      ctx.log(`Falha ao probe XSS em ${path}`);
    }
  }

  return [
    {
      owaspId: "A03",
      checkId: "reflected-xss",
      title: "XSS refletido não confirmado",
      severity: "info",
      status: "pass",
      evidence:
        "Payload de probe não foi refletido sem encoding nos endpoints testados.",
      risk: "Nenhum XSS refletido confirmado nestes endpoints; ainda pode existir em outros parâmetros/páginas.",
      recommendation:
        "Mantenha encoding de saída em todos os pontos e revise formulários, busca e páginas de erro.",
    },
  ];
}

const SQLI_PAYLOADS = ["'", "\"", "1 OR 1=1", "1' OR '1'='1"];

export async function checkSqliHeuristic(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("Executando probes heurísticos de SQL Injection…");
  const findings: Finding[] = [];
  const errorMarkers = [
    "sql syntax",
    "sqlite_error",
    "mysql",
    "postgresql",
    "odbc",
    "ora-",
    "unclosed quotation",
    "you have an error in your sql",
    "syntax error",
  ];

  const endpoints = ["/users", "/user", "/product", "/items", "/search"];

  const sqliRisk =
    "SQL Injection permite ler, alterar ou apagar dados do banco, contornar login e, em casos graves, executar comandos no servidor. É uma das falhas de maior impacto em aplicações web.";
  const sqliFix =
    "Use sempre queries parametrizadas / prepared statements ou ORM (Prisma, Sequelize, etc.). Nunca concatene input em SQL. Valide tipos (ex.: id numérico). Minimize privilégios do usuário do banco. Ex. errado: `SELECT * FROM users WHERE id = '${id}'`. Ex. certo: `db.prepare('SELECT * FROM users WHERE id = ?').get(id)`.";

  for (const endpoint of endpoints) {
    for (const payload of SQLI_PAYLOADS) {
      const path = `${endpoint}?id=${encodeURIComponent(payload)}`;
      try {
        const res = await safeFetch(ctx, path);
        const text = (await res.text()).slice(0, 3000).toLowerCase();
        const hit = errorMarkers.find((m) => text.includes(m));
        if (hit) {
          ctx.log(`Possível SQLi em ${path} (marcador: ${hit})`);
          findings.push({
            owaspId: "A03",
            checkId: "sqli-heuristic",
            title: "Possível SQL Injection",
            severity: "critical",
            status: "fail",
            evidence: `Endpoint ${path} respondeu com indício de erro SQL ("${hit}").`,
            risk: sqliRisk,
            recommendation: sqliFix,
          });
          return findings;
        }
      } catch {
        // ignore
      }
    }
  }

  try {
    const res = await safeFetch(ctx, `/users?id=${encodeURIComponent("'")}`);
    const text = (await res.text()).toLowerCase();
    if (
      text.includes("sql") ||
      text.includes("syntax") ||
      text.includes("sqlite")
    ) {
      return [
        {
          owaspId: "A03",
          checkId: "sqli-heuristic",
          title: "Possível SQL Injection",
          severity: "critical",
          status: "fail",
          evidence: "Resposta em /users?id=' indica erro de SQL.",
          risk: sqliRisk,
          recommendation: sqliFix,
        },
      ];
    }
  } catch {
    // ignore
  }

  return [
    {
      owaspId: "A03",
      checkId: "sqli-heuristic",
      title: "SQL Injection não confirmada",
      severity: "info",
      status: "pass",
      evidence: "Probes heurísticos não retornaram erros SQL claros.",
      risk: "Nenhuma indicação clara nestes probes; parâmetros não testados ainda podem ser vulneráveis.",
      recommendation:
        "Continue com prepared statements em todos os pontos e faça testes manuais em filtros/ordenação/busca.",
    },
  ];
}
