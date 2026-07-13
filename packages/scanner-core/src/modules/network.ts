import dns from "dns/promises";
import net from "net";
import { Finding, CheckContext, SecurityCheck, safeFetch, normalizeTargetUrl } from "../types";

async function tcpConnectTime(host: string, port: number, timeoutMs = 5000) {
  const started = Date.now();
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("TCP timeout"));
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  return Date.now() - started;
}

export async function checkDnsResolve(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("Resolvendo DNS do alvo…");
  const url = new URL(normalizeTargetUrl(ctx.targetUrl));
  const host = url.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return [
      {
        owaspId: "NET",
        checkId: "net-dns",
        title: "DNS local (localhost)",
        severity: "info",
        status: "pass",
        evidence: `Host ${host} não requer resolução DNS pública.`,
        risk: "Sem risco de DNS neste alvo local.",
        recommendation:
          "Em produção, monitore DNS (TTL, failover, DNSSEC) e use health checks.",
      },
    ];
  }

  try {
    const started = Date.now();
    const records = await dns.lookup(host, { all: true });
    const ms = Date.now() - started;
    ctx.log(`DNS ${host} → ${records.map((r) => r.address).join(", ")} (${ms}ms)`);
    return [
      {
        owaspId: "NET",
        checkId: "net-dns",
        title: "Resolução DNS ok",
        severity: "info",
        status: "pass",
        evidence: `${host} resolveu em ${ms}ms: ${records.map((r) => r.address).join(", ")}`,
        risk: "DNS respondeu; falhas de DNS em produção causam indisponibilidade total.",
        recommendation:
          "Configure DNS redundante, monitore resolução e TTLs adequados a failover.",
      },
    ];
  } catch (err) {
    const message = err instanceof Error ? err.message : "falha DNS";
    return [
      {
        owaspId: "NET",
        checkId: "net-dns",
        title: "Falha na resolução DNS",
        severity: "critical",
        status: "fail",
        evidence: `Não foi possível resolver ${host}: ${message}`,
        risk: "Sem DNS, clientes não alcançam a aplicação — outage completo.",
        recommendation:
          "Verifique registros A/AAAA/CNAME, nameservers e propagação. Monitore com ferramentas de rede/DNS.",
      },
    ];
  }
}

export async function checkTcpConnect(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("Medindo tempo de conexão TCP…");
  const url = new URL(normalizeTargetUrl(ctx.targetUrl));
  const host = url.hostname;
  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80;

  try {
    const ms = await tcpConnectTime(host, port);
    ctx.log(`TCP ${host}:${port} conectou em ${ms}ms`);
    if (ms > 1000) {
      return [
        {
          owaspId: "NET",
          checkId: "net-tcp",
          title: "Conexão TCP lenta",
          severity: "medium",
          status: "fail",
          evidence: `TCP ${host}:${port} em ${ms}ms`,
          risk: "Handshake lento indica congestão, rota ruim ou servidor saturado — piora latência percebida e timeouts.",
          recommendation:
            "Verifique firewall, load balancer, região/CDN e saturação do servidor. Use iPerf/mtr para diagnóstico de banda e perda entre pontos.",
        },
      ];
    }
    return [
      {
        owaspId: "NET",
        checkId: "net-tcp",
        title: "Conexão TCP ok",
        severity: "info",
        status: "pass",
        evidence: `TCP ${host}:${port} em ${ms}ms`,
        risk: "Camada de transporte respondeu rapidamente neste probe.",
        recommendation:
          "Para largura de banda e perda de pacotes (L2–L4), complemente com iPerf/mtr entre datacenters.",
      },
    ];
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro TCP";
    return [
      {
        owaspId: "NET",
        checkId: "net-tcp",
        title: "Falha na conexão TCP",
        severity: "critical",
        status: "fail",
        evidence: `TCP ${host}:${port} falhou: ${message}`,
        risk: "Porta inacessível = serviço fora do ar ou bloqueio de firewall/rede.",
        recommendation:
          "Confirme se o serviço está escutando, security groups/firewall e health do load balancer.",
      },
    ];
  }
}

export async function checkHttpLatency(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("Medindo latência HTTP (5 amostras)…");
  const samples: number[] = [];
  let failures = 0;

  for (let i = 0; i < 5; i++) {
    const started = Date.now();
    try {
      const res = await safeFetch(ctx, "/");
      samples.push(Date.now() - started);
      void res.arrayBuffer().catch(() => undefined);
      ctx.log(`Amostra ${i + 1}: ${samples[samples.length - 1]}ms (HTTP ${res.status})`);
    } catch {
      failures += 1;
      samples.push(Date.now() - started);
      ctx.log(`Amostra ${i + 1}: falhou`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const max = Math.max(...samples);
  const min = Math.min(...samples);
  const jitter = max - min;

  if (failures >= 2) {
    return [
      {
        owaspId: "NET",
        checkId: "net-latency",
        title: "Latência HTTP instável / falhas",
        severity: "high",
        status: "fail",
        evidence: `5 amostras: avg=${avg}ms min=${min}ms max=${max}ms jitter≈${jitter}ms falhas=${failures}`,
        risk: "Perda/instabilidade na conectividade HTTP degrada UX e pode indicar problemas de rota, proxy ou backend.",
        recommendation:
          "Correlacione com monitoramento de rede. Para perda de pacotes e banda, use iPerf/mtr; para app, revise timeouts e retries.",
      },
    ];
  }

  if (avg > 1500 || jitter > 1200) {
    return [
      {
        owaspId: "NET",
        checkId: "net-latency",
        title: "Latência HTTP elevada ou com jitter",
        severity: "medium",
        status: "fail",
        evidence: `5 amostras: avg=${avg}ms min=${min}ms max=${max}ms jitter≈${jitter}ms falhas=${failures}`,
        risk: "Latência alta/variável afeta conversão, APIs dependentes e filas. Pode mascarar saturação ou rota ruim.",
        recommendation:
          "Use CDN, otimize TTFB, revise região do servidor. Meça perda/banda com iPerf entre pontas críticas.",
      },
    ];
  }

  return [
    {
      owaspId: "NET",
      checkId: "net-latency",
      title: "Latência HTTP aceitável",
      severity: "info",
      status: "pass",
      evidence: `5 amostras: avg=${avg}ms min=${min}ms max=${max}ms jitter≈${jitter}ms`,
      risk: "Latência do probe dentro de faixa razoável.",
      recommendation:
        "Continue monitorando SLOs de latência. iPerf continua sendo a referência para teste puro de banda L2–L4.",
    },
  ];
}

export const networkChecks: SecurityCheck[] = [
  {
    id: "net-dns",
    owaspId: "NET",
    name: "Resolução DNS",
    mode: "auto",
    description: "Resolve o hostname do alvo e mede tempo de lookup.",
    run: checkDnsResolve,
  },
  {
    id: "net-tcp",
    owaspId: "NET",
    name: "Conectividade TCP",
    mode: "auto",
    description: "Mede tempo de estabelecimento TCP na porta do serviço.",
    run: checkTcpConnect,
  },
  {
    id: "net-latency",
    owaspId: "NET",
    name: "Latência HTTP",
    mode: "auto",
    description: "Coleta amostras de latência HTTP e jitter aproximado.",
    run: checkHttpLatency,
  },
];
