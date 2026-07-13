import { Finding, CheckContext, SecurityCheck, safeFetch } from "../types";

async function runBurst(
  ctx: CheckContext,
  {
    total,
    concurrency,
    path,
  }: { total: number; concurrency: number; path: string }
) {
  const latencies: number[] = [];
  let success = 0;
  let errors = 0;
  let status5xx = 0;
  let status4xx = 0;

  let next = 0;
  async function worker() {
    while (next < total) {
      const i = next++;
      if (i >= total) break;
      const started = Date.now();
      try {
        const res = await safeFetch(ctx, path, { method: "GET" });
        const ms = Date.now() - started;
        latencies.push(ms);
        if (res.status >= 500) {
          status5xx += 1;
          errors += 1;
        } else if (res.status >= 400) {
          status4xx += 1;
          // count as completed but degraded
          success += 1;
        } else {
          success += 1;
        }
        void res.arrayBuffer().catch(() => undefined);
      } catch {
        errors += 1;
        latencies.push(Date.now() - started);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  const wallStart = Date.now();
  await Promise.all(workers);
  const wallMs = Date.now() - wallStart;

  latencies.sort((a, b) => a - b);
  const pct = (p: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]
      : 0;

  return {
    total,
    concurrency,
    success,
    errors,
    status4xx,
    status5xx,
    wallMs,
    rps: wallMs > 0 ? (total / wallMs) * 1000 : 0,
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    avg:
      latencies.length === 0
        ? 0
        : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
  };
}

export async function checkLoadBaseline(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("Carga leve: 20 requests com concorrência 2…");
  const stats = await runBurst(ctx, { total: 20, concurrency: 2, path: "/" });
  ctx.log(
    `Baseline: avg ${stats.avg}ms · p95 ${stats.p95}ms · erros ${stats.errors}/${stats.total} · ~${stats.rps.toFixed(1)} req/s`
  );

  const errorRate = stats.errors / stats.total;
  if (errorRate > 0.1 || stats.p95 > 3000) {
    return [
      {
        owaspId: "LOAD",
        checkId: "load-baseline",
        title: "Carga leve com degradação",
        severity: "high",
        status: "fail",
        evidence: `20 req (c=2): avg=${stats.avg}ms p95=${stats.p95}ms erros=${stats.errors} 5xx=${stats.status5xx} rps≈${stats.rps.toFixed(1)}`,
        risk: "Mesmo com tráfego moderado a aplicação já mostra lentidão ou erros. Em pico real (campanha, horário comercial) há alto risco de queda e timeout para usuários.",
        recommendation:
          "Investigue gargalos (CPU, DB, N+1 queries), adicione cache, connection pool e autoscaling. Ferramentas: k6/JMeter para carga; Icinga/Nagios/Prometheus para monitoramento de saturação.",
      },
    ];
  }

  return [
    {
      owaspId: "LOAD",
      checkId: "load-baseline",
      title: "Carga leve estável",
      severity: "info",
      status: "pass",
      evidence: `20 req (c=2): avg=${stats.avg}ms p95=${stats.p95}ms erros=${stats.errors} rps≈${stats.rps.toFixed(1)}`,
      risk: "Sob carga leve o alvo respondeu de forma aceitável neste probe.",
      recommendation:
        "Mantenha testes periódicos com k6/JMeter e alertas de latência/erro no monitoramento (Icinga, Nagios, Prometheus).",
    },
  ];
}

export async function checkLoadStress(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("Estresse: 60 requests com concorrência 10…");
  const stats = await runBurst(ctx, { total: 60, concurrency: 10, path: "/" });
  ctx.log(
    `Stress: avg ${stats.avg}ms · p95 ${stats.p95}ms · erros ${stats.errors}/${stats.total} · ~${stats.rps.toFixed(1)} req/s`
  );

  const errorRate = stats.errors / stats.total;
  const findings: Finding[] = [];

  if (errorRate >= 0.15 || stats.status5xx >= 5) {
    findings.push({
      owaspId: "LOAD",
      checkId: "load-stress",
      title: "Estresse: falhas sob pico",
      severity: "critical",
      status: "fail",
      evidence: `60 req (c=10): avg=${stats.avg}ms p95=${stats.p95}ms erros=${stats.errors} 5xx=${stats.status5xx} 4xx=${stats.status4xx} rps≈${stats.rps.toFixed(1)}`,
      risk: "Sob pico concorrente o servidor falha ou devolve 5xx. Usuários veem indisponibilidade; pode haver cascata (retry storm) e perda de receita/SLA.",
      recommendation:
        "Defina limites de concorrência, circuit breaker, fila/backpressure e autoscaling. Teste com ramp-up (k6). Monitore saturação de workers, DB connections e memória.",
    });
  } else if (stats.p95 > 2500 || stats.avg > 1200) {
    findings.push({
      owaspId: "LOAD",
      checkId: "load-stress",
      title: "Estresse: latência elevada sob pico",
      severity: "high",
      status: "fail",
      evidence: `60 req (c=10): avg=${stats.avg}ms p50=${stats.p50}ms p95=${stats.p95}ms p99=${stats.p99}ms erros=${stats.errors}`,
      risk: "A aplicação aguenta sem muitos erros, mas fica lenta sob pico — abandono de sessão, timeouts de gateway e fila de suporte.",
      recommendation:
        "Otimize endpoints críticos, cache, CDN e índices de DB. Estabeleça SLO de p95 e faça capacity planning com testes de carga regulares.",
    });
  } else {
    findings.push({
      owaspId: "LOAD",
      checkId: "load-stress",
      title: "Estresse: comportamento aceitável no probe",
      severity: "info",
      status: "pass",
      evidence: `60 req (c=10): avg=${stats.avg}ms p95=${stats.p95}ms erros=${stats.errors} rps≈${stats.rps.toFixed(1)}`,
      risk: "Neste pico sintético curto o alvo se manteve estável. Picos maiores/reais ainda precisam de validação.",
      recommendation:
        "Escale o teste (mais VUs, duração maior) em ambiente de staging com k6/JMeter antes de eventos de alto tráfego.",
    });
  }

  return findings;
}

export const loadChecks: SecurityCheck[] = [
  {
    id: "load-baseline",
    owaspId: "LOAD",
    name: "Carga leve (baseline)",
    mode: "auto",
    description: "20 requisições HTTP com baixa concorrência para baseline de latência/erros.",
    run: checkLoadBaseline,
  },
  {
    id: "load-stress",
    owaspId: "LOAD",
    name: "Estresse (pico)",
    mode: "auto",
    description: "60 requisições com concorrência 10 para observar degradação sob pico.",
    run: checkLoadStress,
  },
];
