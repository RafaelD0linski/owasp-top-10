import Link from "next/link";

export type AppCardData = {
  id: string;
  label: string;
  url: string;
  isDemo: boolean;
  scanCount: number;
  latestScan: {
    id: string;
    status: string;
    score: number | null;
    findingsCount: number;
    createdAt: Date;
  } | null;
};

function hostFromUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function scoreTone(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export function AppsGrid({ apps }: { apps: AppCardData[] }) {
  if (apps.length === 0) {
    return (
      <div className="card fade-up">
        <h2 style={{ marginTop: 0 }}>Suas aplicações</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Ainda não há alvos. Rode a demo ou cadastre uma URL autorizada.
        </p>
        <Link className="btn btn-primary" href="/scans/new">
          Adicionar aplicação
        </Link>
      </div>
    );
  }

  return (
    <section className="fade-up" style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: "1rem",
          marginBottom: "0.85rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Suas aplicações</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Grid das apps que você está testando ou já testou.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/scans/new">
          + Nova aplicação
        </Link>
      </div>

      <div className="apps-grid">
        {apps.map((app) => {
          const latest = app.latestScan;
          const tone = scoreTone(latest?.score ?? null);
          return (
            <article className="app-card" key={app.id}>
              <div className="app-card__top">
                <div className="app-card__icon" aria-hidden>
                  {hostFromUrl(app.url).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="app-card__title-row">
                    <h3 className="app-card__title">{app.label}</h3>
                    {app.isDemo ? (
                      <span className="status-pill status-running">demo</span>
                    ) : null}
                  </div>
                  <p className="app-card__url mono">{app.url}</p>
                </div>
              </div>

              <div className="app-card__stats">
                <div>
                  <div className="app-stat-label">Último score</div>
                  <div className={`app-stat-value score-${tone}`}>
                    {latest?.score ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="app-stat-label">Scans</div>
                  <div className="app-stat-value">{app.scanCount}</div>
                </div>
                <div>
                  <div className="app-stat-label">Status</div>
                  <div>
                    {latest ? (
                      <span className={`status-pill status-${latest.status}`}>
                        {latest.status}
                      </span>
                    ) : (
                      <span className="muted">sem scan</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="app-card__meta muted">
                {latest
                  ? `Último teste: ${new Date(latest.createdAt).toLocaleString("pt-BR")} · ${latest.findingsCount} findings`
                  : "Nenhum teste ainda"}
              </div>

              <div className="app-card__actions">
                {latest ? (
                  <>
                    <Link className="btn btn-ghost" href={`/scans/${latest.id}`}>
                      Ao vivo
                    </Link>
                    <Link
                      className="btn btn-ghost"
                      href={`/scans/${latest.id}/report`}
                    >
                      Relatório
                    </Link>
                    <a
                      className="btn btn-primary"
                      href={`/api/scans/${latest.id}/report?format=pdf`}
                    >
                      PDF
                    </a>
                  </>
                ) : (
                  <Link className="btn btn-primary" href="/scans/new">
                    Iniciar scan
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
