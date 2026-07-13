import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildPdfReport } from "@/lib/pdf-report";

function severityWeight(s: string) {
  switch (s) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

function renderHtmlReport(scan: {
  id: string;
  status: string;
  score: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  target: { url: string; label: string };
  findings: {
    owaspId: string;
    title: string;
    severity: string;
    status: string;
    evidence: string;
    risk: string;
    recommendation: string;
  }[];
}) {
  const fails = scan.findings.filter((f) => f.status === "fail");
  const cards = [...scan.findings]
    .filter((f) => f.status === "fail" || f.status === "manual" || f.status === "pass")
    .sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity))
    .map(
      (f) => `
      <article class="finding">
        <header>
          <div>
            <div class="owasp">${f.owaspId}</div>
            <h2>${escapeHtml(f.title)}</h2>
          </div>
          <div>
            <span class="sev ${f.severity}">${f.severity}</span>
            <span class="status">${f.status}</span>
          </div>
        </header>
        <div class="block">
          <h3>Evidência</h3>
          <p>${escapeHtml(f.evidence)}</p>
        </div>
        <div class="block risk">
          <h3>Risco para a aplicação</h3>
          <p>${escapeHtml(f.risk || "Revise o impacto no contexto do seu sistema.")}</p>
        </div>
        <div class="block fix">
          <h3>Como corrigir</h3>
          <p>${escapeHtml(f.recommendation)}</p>
        </div>
      </article>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório OWASP — ${escapeHtml(scan.target.label)}</title>
  <style>
    body { font-family: "Segoe UI", Georgia, serif; margin: 0; color: #1a1a1a; background: #f4f6f5; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 32px 20px 60px; }
    h1 { font-size: 1.8rem; margin-bottom: 0.2rem; }
    .meta { color: #555; margin-bottom: 1.5rem; line-height: 1.5; }
    .score { font-size: 2.2rem; font-weight: bold; color: #0a7a45; }
    .banner { background: #fff3cd; border: 1px solid #f0d78c; padding: 10px 14px; margin-bottom: 20px; border-radius: 8px; }
    .finding { background: #fff; border: 1px solid #dfe5e1; border-radius: 12px; padding: 18px 20px; margin-bottom: 14px; }
    .finding header { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 12px; }
    .finding h2 { font-size: 1.1rem; margin: 4px 0 0; }
    .owasp { font-family: ui-monospace, monospace; color: #666; font-size: 0.85rem; }
    .block h3 { margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .block p { margin: 0 0 10px; line-height: 1.5; }
    .risk h3 { color: #a06a00; }
    .fix h3 { color: #0a7a45; }
    .sev { padding: 2px 8px; border-radius: 4px; color: #fff; text-transform: uppercase; font-size: 0.72rem; margin-right: 6px; }
    .status { font-size: 0.8rem; color: #555; }
    .critical { background: #8b0000; }
    .high { background: #c0392b; }
    .medium { background: #d68910; }
    .low { background: #2980b9; }
    .info { background: #7f8c8d; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="banner">Uso autorizado apenas. Relatório gerado pelo OWASP Scan Lab.</div>
    <h1>Relatório de segurança</h1>
    <p class="meta">
      Alvo: <strong>${escapeHtml(scan.target.label)}</strong> (${escapeHtml(scan.target.url)})<br/>
      Scan: ${scan.id}<br/>
      Status: ${scan.status} · Score: <span class="score">${scan.score ?? "—"}</span><br/>
      Falhas: ${fails.length} · Findings: ${scan.findings.length}
    </p>
    ${cards}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") || "json";

  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
    include: {
      target: true,
      findings: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan não encontrado" }, { status: 404 });
  }

  if (format === "pdf") {
    const pdf = await buildPdfReport(scan);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="owasp-report-${scan.id}.pdf"`,
      },
    });
  }

  if (format === "html") {
    const html = renderHtmlReport(scan);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="owasp-report-${scan.id}.html"`,
      },
    });
  }

  return NextResponse.json(
    {
      reportVersion: "1.1",
      generatedAt: new Date().toISOString(),
      scan: {
        id: scan.id,
        status: scan.status,
        score: scan.score,
        startedAt: scan.startedAt,
        finishedAt: scan.finishedAt,
        target: scan.target,
        findings: scan.findings,
      },
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="owasp-report-${scan.id}.json"`,
      },
    }
  );
}
