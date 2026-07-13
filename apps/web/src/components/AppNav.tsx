"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppNav({
  email,
}: {
  email?: string | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand">
        <span className="brand-mark">OWASP Scan Lab</span>
        <span className="brand-sub">Top 10 · demo ao vivo</span>
      </Link>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
        {email ? <span className="muted" style={{ fontSize: "0.85rem" }}>{email}</span> : null}
        <Link className="btn btn-ghost" href="/scans/new">
          Novo scan
        </Link>
        <button className="btn btn-ghost" onClick={logout} type="button">
          Sair
        </button>
      </div>
    </nav>
  );
}
