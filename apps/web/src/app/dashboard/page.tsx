import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { AppsGrid, type AppCardData } from "@/components/AppsGrid";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const targets = await prisma.target.findMany({
    where: { userId: user.id },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { findings: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type Group = {
    id: string;
    label: string;
    url: string;
    isDemo: boolean;
    scans: (typeof targets)[number]["scans"];
  };

  const byUrl = new Map<string, Group>();
  for (const t of targets) {
    const existing = byUrl.get(t.url);
    if (!existing) {
      byUrl.set(t.url, {
        id: t.id,
        label: t.label,
        url: t.url,
        isDemo: t.isDemo,
        scans: [...t.scans],
      });
    } else {
      existing.scans.push(...t.scans);
      existing.isDemo = existing.isDemo || t.isDemo;
      if (t.createdAt > (targets.find((x) => x.id === existing.id)?.createdAt || t.createdAt)) {
        existing.label = t.label;
        existing.id = t.id;
      }
    }
  }

  const apps: AppCardData[] = [...byUrl.values()].map((g) => {
    const scansSorted = [...g.scans].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const latest = scansSorted[0];
    return {
      id: g.id,
      label: g.label,
      url: g.url,
      isDemo: g.isDemo,
      scanCount: scansSorted.length,
      latestScan: latest
        ? {
            id: latest.id,
            status: latest.status,
            score: latest.score,
            findingsCount: latest._count.findings,
            createdAt: latest.createdAt,
          }
        : null,
    };
  });

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    include: {
      target: true,
      _count: { select: { findings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main className="shell">
      <AppNav email={user.email} />

      <div className="card fade-up" style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Dashboard</h1>
            <p className="muted" style={{ margin: "0.4rem 0 0" }}>
              Acompanhe aplicações testadas, rode novos scans e baixe PDFs.
            </p>
          </div>
          <Link className="btn btn-primary" href="/scans/new">
            Novo scan
          </Link>
        </div>
      </div>

      <AppsGrid apps={apps} />

      <div className="card fade-up">
        <h2 style={{ marginTop: 0 }}>Histórico de scans</h2>
        {scans.length === 0 ? (
          <p className="muted">
            Nenhum scan ainda. Use o modo demo para ver o fluxo completo.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Alvo</th>
                <th>Status</th>
                <th>Score</th>
                <th>Findings</th>
                <th>Quando</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td>
                    <div>{scan.target.label}</div>
                    <div className="muted mono" style={{ fontSize: "0.8rem" }}>
                      {scan.target.url}
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill status-${scan.status}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="mono">{scan.score ?? "—"}</td>
                  <td>{scan._count.findings}</td>
                  <td className="muted">
                    {new Date(scan.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link href={`/scans/${scan.id}`}>Ao vivo</Link>
                    {" · "}
                    <Link href={`/scans/${scan.id}/report`}>Relatório</Link>
                    {" · "}
                    <a href={`/api/scans/${scan.id}/report?format=pdf`}>PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
