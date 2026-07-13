import { NextResponse } from "next/server";
import { getCheckCatalog, getModuleCatalog } from "@owasp/scanner-core";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({
    modules: getModuleCatalog(),
    checks: getCheckCatalog(),
  });
}
