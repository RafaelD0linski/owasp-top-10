"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MODULE_OPTIONS = [
  {
    id: "security",
    title: "Segurança (Pentest)",
    blurb:
      "Vulnerabilidades web OWASP Top 10 (visão educacional estilo ZAP/Burp).",
  },
  {
    id: "load",
    title: "Carga e Estresse",
    blurb:
      "Picos de requisições HTTP: latência, erros e estabilidade sob demanda.",
  },
  {
    id: "network",
    title: "Rede e Conectividade",
    blurb: "DNS, TCP e latência HTTP (complementa diagnósticos tipo iPerf).",
  },
  {
    id: "disaster-recovery",
    title: "Disaster Recovery",
    blurb: "Checklist de backups, restore (RTO/RPO) e failover.",
  },
] as const;

export function NewScanForm() {
  const router = useRouter();
  const [label, setLabel] = useState("Meu alvo local");
  const [url, setUrl] = useState("http://localhost:4000");
  const [authorized, setAuthorized] = useState(false);
  const [modules, setModules] = useState<string[]>([
    "security",
    "load",
    "network",
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canStart = useMemo(
    () => authorized && modules.length > 0 && !loading,
    [authorized, modules, loading]
  );

  function toggleModule(id: string) {
    setModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function createAndStart(opts: {
    isDemo?: boolean;
    label: string;
    url: string;
    authorized: boolean;
    modules: string[];
  }) {
    setError("");
    if (opts.modules.length === 0) {
      setError("Selecione ao menos um tipo de teste.");
      return;
    }
    setLoading(true);
    try {
      const targetRes = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: opts.label,
          url: opts.url,
          authorized: opts.authorized,
          isDemo: opts.isDemo,
        }),
      });
      const targetData = await targetRes.json();
      if (!targetRes.ok) {
        setError(targetData.error || "Falha ao criar alvo");
        return;
      }

      const scanRes = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: targetData.target.id,
          modules: opts.modules,
        }),
      });
      const scanData = await scanRes.json();
      if (!scanRes.ok) {
        setError(scanData.error || "Falha ao iniciar scan");
        return;
      }

      router.push(`/scans/${scanData.scan.id}`);
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await createAndStart({ label, url, authorized, modules, isDemo: false });
  }

  async function runDemo() {
    await createAndStart({
      isDemo: true,
      label: "Alvo Demo",
      url: "http://localhost:4000",
      authorized: true,
      modules:
        modules.length > 0
          ? modules
          : ["security", "load", "network", "disaster-recovery"],
    });
  }

  return (
    <div className="grid-2 fade-up">
      <form className="card stack" onSubmit={onSubmit}>
        <div>
          <h2 style={{ margin: 0 }}>Novo teste</h2>
          <p className="muted" style={{ marginTop: "0.35rem" }}>
            Escolha o alvo e quais módulos rodar. Hosts permitidos em{" "}
            <span className="mono">ALLOWED_SCAN_HOSTS</span>.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="label">
            Nome do alvo
          </label>
          <input
            id="label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="url">
            URL
          </label>
          <input
            id="url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:4000"
            required
          />
        </div>

        <div>
          <div className="label">Tipos de teste</div>
          <div className="module-picker">
            {MODULE_OPTIONS.map((mod) => {
              const checked = modules.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  className={`module-option ${checked ? "is-on" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModule(mod.id)}
                  />
                  <span>
                    <strong>{mod.title}</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      {mod.blurb}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <label
          style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}
        >
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            Confirmo que possuo este sistema ou tenho autorização por escrito
            para realizar estes testes.
          </span>
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="btn btn-primary" disabled={!canStart} type="submit">
          {loading ? "Iniciando…" : "Iniciar testes selecionados"}
        </button>
      </form>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Modo demo</h3>
        <p className="muted" style={{ margin: 0 }}>
          Com <span className="mono">npm run dev:target</span>, rode os módulos
          marcados contra o alvo vulnerável local.
        </p>
        <button
          className="btn btn-primary"
          type="button"
          disabled={loading || modules.length === 0}
          onClick={runDemo}
        >
          Rodar demo (localhost:4000)
        </button>
        <ul
          className="muted"
          style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}
        >
          <li>Segurança: XSS, SQLi, headers, auth fraca</li>
          <li>Carga: baseline + pico concorrente</li>
          <li>Rede: DNS/TCP/latência</li>
          <li>DR: checklists de backup e restore</li>
        </ul>
      </div>
    </div>
  );
}
