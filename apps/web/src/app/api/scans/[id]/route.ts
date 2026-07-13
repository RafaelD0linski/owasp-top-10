import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
    include: {
      target: true,
      findings: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ scan });
}
