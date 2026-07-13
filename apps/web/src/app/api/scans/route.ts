import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/scan-utils";
import { startScanJob } from "@/lib/orchestrator";
import { normalizeModuleIds } from "@owasp/scanner-core";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    include: {
      target: true,
      _count: { select: { findings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ scans });
}

const createSchema = z.object({
  targetId: z.string().min(1),
  modules: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Rate limit: aguarde antes de iniciar outro scan." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "targetId obrigatório" }, { status: 400 });
  }

  const target = await prisma.target.findFirst({
    where: { id: parsed.data.targetId, userId: user.id },
  });
  if (!target) {
    return NextResponse.json({ error: "Alvo não encontrado" }, { status: 404 });
  }

  const modules = normalizeModuleIds(parsed.data.modules);
  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      targetId: target.id,
      status: "pending",
      modules: JSON.stringify(modules),
    },
  });

  await startScanJob(scan.id, target.url, modules);

  return NextResponse.json({ scan });
}
