"use client";

import { useMemo, useState } from "react";

type Finding = {
  id: string;
  owaspId: string;
  title: string;
  severity: string;
  status: string;
  evidence: string;
  risk: string;
  recommendation: string;
};

export function ReportView({
  scanId,
  score,
  targetLabel,
  targetUrl,
  findings,
}: {
  scanId: string;
  score: number | null;
  targetLabel: string;
  targetUrl: string;
  findings: Finding[];
}) {
  const [severity, setSeverity] = useState<string>("all");
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = findings;
    if (onlyProblems) {
      list = list.filter((f) => f.status === "fail" || f.status === "manual");
    }
    if (severity !== "all") {
      list = list.filter((f) => f.severity === severity);
    }
    if (category !== "all") {
      list = list.filter((f) => {
        if (category === "security") {
          return f.owaspId.startsWith("A");
        }
        return f.owaspId === category;
      });
    }
    const weight = (s: string) =>
      ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s] ?? 5);
    return [...list].sort(
      (a, b) => weight(a.severity) - weight(b.severity)
    );
  }, [findings, severity, onlyProblems, category]);

  const fails = findings.filter((f) => f.status === "fail").length;
  const manuals = findings.filter((f) => f.status === "manual").length;

  return (
    <div className="stack fade-up">
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 0.35rem" }}>Relatório</h1>
          <p className="muted" style={{ margin: 0 }}>
            {targetLabel} · <span className="mono">{targetUrl}</span>
          </p>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {fails} falhas · {manuals} assistidos · {findings.length} findings
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Score
          </div>
          <div className="score-big">{score ?? "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <a
          className="btn btn-primary"
          href={`/api/scans/${scanId}/report?format=pdf`}
        >
          Baixar PDF
        </a>
        <a
          className="btn btn-ghost"
          href={`/api/scans/${scanId}/report?format=html`}
        >
          Baixar HTML
        </a>
        <a
          className="btn btn-ghost"
          href={`/api/scans/${scanId}/report?format=json`}
        >
          Baixar JSON
        </a>
        <select
          className="input"
          style={{ width: "auto" }}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">Todas severidades</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          className="input"
          style={{ width: "auto" }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todos os módulos</option>
          <option value="security">Segurança (A0x)</option>
          <option value="LOAD">Carga / Estresse</option>
          <option value="NET">Rede</option>
          <option value="DR">Disaster Recovery</option>
        </select>
        <label
          className="muted"
          style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.9rem" }}
        >
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
          />
          Só falhas e assistidos
        </label>
      </div>

      <div className="stack">
        {filtered.map((f) => (
          <article className="finding-card" key={f.id}>
            <header className="finding-card__head">
              <div>
                <span className="mono muted">{f.owaspId}</span>
                <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.05rem" }}>
                  {f.title}
                </h3>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <span className={`sev sev-${f.severity}`}>{f.severity}</span>
                <span className={`status-pill status-${f.status}`}>
                  {f.status}
                </span>
              </div>
            </header>

            <div className="finding-card__grid">
              <section>
                <h4 className="finding-label">Evidência</h4>
                <p className="finding-body muted">{f.evidence}</p>
              </section>
              <section>
                <h4 className="finding-label finding-label--risk">
                  Risco para a aplicação
                </h4>
                <p className="finding-body">
                  {f.risk ||
                    "Revise o impacto deste finding no contexto do seu sistema."}
                </p>
              </section>
              <section className="finding-card__fix">
                <h4 className="finding-label finding-label--fix">
                  Como corrigir
                </h4>
                <p className="finding-body">{f.recommendation}</p>
              </section>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              Nenhum finding neste filtro.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
