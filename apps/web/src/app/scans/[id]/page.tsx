import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { LiveScanView } from "@/components/LiveScanView";

export default async function ScanLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
    include: { target: true },
  });
  if (!scan) notFound();

  return (
    <main className="shell">
      <AppNav email={user.email} />
      <p className="muted" style={{ marginTop: 0 }}>
        Alvo: <strong>{scan.target.label}</strong>{" "}
        <span className="mono">({scan.target.url})</span>
      </p>
      <LiveScanView scanId={scan.id} modulesJson={scan.modules} />
    </main>
  );
}
