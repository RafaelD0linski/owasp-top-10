import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { assertTargetAllowed } from "@/lib/scan-utils";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const targets = await prisma.target.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ targets });
}

const createSchema = z.object({
  url: z.string().min(1),
  label: z.string().min(1).max(80),
  authorized: z.boolean(),
  isDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (!parsed.data.authorized) {
    return NextResponse.json(
      { error: "Você precisa confirmar autorização para testar o alvo." },
      { status: 400 }
    );
  }

  let url = parsed.data.url;
  if (parsed.data.isDemo) {
    url = process.env.DEMO_TARGET_URL || "http://localhost:4000";
  }

  try {
    url = assertTargetAllowed(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Alvo inválido" },
      { status: 400 }
    );
  }

  const target = await prisma.target.create({
    data: {
      userId: user.id,
      url,
      label: parsed.data.isDemo ? "Alvo Demo (vulnerável)" : parsed.data.label,
      isDemo: Boolean(parsed.data.isDemo),
      authorizedAt: new Date(),
    },
  });

  return NextResponse.json({ target });
}
