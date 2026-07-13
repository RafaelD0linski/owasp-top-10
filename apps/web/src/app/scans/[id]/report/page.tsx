import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/AppNav";
import { ReportView } from "@/components/ReportView";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
    include: {
      target: true,
      findings: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!scan) notFound();

  return (
    <main className="shell">
      <AppNav email={user.email} />
      <ReportView
        scanId={scan.id}
        score={scan.score}
        targetLabel={scan.target.label}
        targetUrl={scan.target.url}
        findings={scan.findings}
      />
    </main>
  );
}
