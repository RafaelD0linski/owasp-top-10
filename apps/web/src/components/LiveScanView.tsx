"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CheckMeta = {
  id: string;
  owaspId: string;
  name: string;
  mode: "auto" | "assisted";
  moduleId?: string;
  moduleName?: string;
};

type CheckState = {
  status: "pending" | "running" | "pass" | "fail" | "manual" | "error";
  message?: string;
};

type LogLine = { at: string; message: string };

type ModuleInfo = {
  id: string;
  name: string;
  shortName: string;
  checks: CheckMeta[];
};

export function LiveScanView({
  scanId,
  modulesJson,
}: {
  scanId: string;
  modulesJson?: string | null;
}) {
  const [checks, setChecks] = useState<CheckMeta[]>([]);
  const [moduleOrder, setModuleOrder] = useState<ModuleInfo[]>([]);
  const [states, setStates] = useState<Record<string, CheckState>>({});
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [scanStatus, setScanStatus] = useState("pending");
  const [done, setDone] = useState(false);

  const selectedModules = useMemo(() => {
    try {
      const parsed = JSON.parse(modulesJson || '["security"]') as string[];
      return parsed.length ? parsed : ["security"];
    } catch {
      return ["security"];
    }
  }, [modulesJson]);

  useEffect(() => {
    void fetch("/api/checks")
      .then((r) => r.json())
      .then((data) => {
        const modules = (data.modules || []) as {
          id: string;
          name: string;
          shortName: string;
          checks: CheckMeta[];
        }[];

        const selected = modules.filter((m) => selectedModules.includes(m.id));
        const list: CheckMeta[] = [];
        const order: ModuleInfo[] = [];

        for (const mod of selected) {
          const withMeta = mod.checks.map((c) => ({
            ...c,
            moduleId: mod.id,
            moduleName: mod.shortName,
          }));
          list.push(...withMeta);
          order.push({
            id: mod.id,
            name: mod.name,
            shortName: mod.shortName,
            checks: withMeta,
          });
        }

        setChecks(list);
        setModuleOrder(order);
        const initial: Record<string, CheckState> = {};
        for (const c of list) initial[c.id] = { status: "pending" };
        setStates(initial);
      });
  }, [selectedModules]);

  useEffect(() => {
    const es = new EventSource(`/api/scans/${scanId}/events`);

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as {
          type: string;
          checkId?: string;
          message?: string;
          findings?: { status: string }[];
          status?: string;
          at?: string;
        };

        if (event.type === "connected" && event.status) {
          setScanStatus(event.status);
          if (event.status === "completed" || event.status === "failed") {
            setDone(true);
          }
        }

        if (event.message) {
          setLogs((prev) => [
            ...prev,
            {
              at: event.at || new Date().toISOString(),
              message: event.message!,
            },
          ]);
        }

        if (event.type === "check_start" && event.checkId) {
          setScanStatus("running");
          setStates((prev) => ({
            ...prev,
            [event.checkId!]: { status: "running", message: event.message },
          }));
        }

        if (event.type === "check_done" && event.checkId) {
          const findings = event.findings || [];
          let status: CheckState["status"] = "pass";
          if (findings.some((f) => f.status === "fail")) status = "fail";
          else if (findings.some((f) => f.status === "manual")) status = "manual";
          else if (findings.some((f) => f.status === "error")) status = "error";

          setStates((prev) => ({
            ...prev,
            [event.checkId!]: { status, message: event.message },
          }));
        }

        if (event.type === "scan_done") {
          setScanStatus("completed");
          setDone(true);
          es.close();
        }

        if (event.type === "scan_error") {
          setScanStatus("failed");
          setDone(true);
          es.close();
        }
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, [scanId]);

  const progress = useMemo(() => {
    const total = checks.length || 1;
    const finished = Object.values(states).filter(
      (s) => s.status !== "pending" && s.status !== "running"
    ).length;
    return Math.round((finished / total) * 100);
  }, [checks, states]);

  return (
    <div className="grid-2 fade-up">
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Execução ao vivo</h2>
            <p className="muted" style={{ margin: "0.3rem 0 0" }}>
              Status:{" "}
              <span className={`status-pill status-${scanStatus}`}>
                {scanStatus}
              </span>
              {" · "}
              {progress}%
              {" · "}
              módulos: {selectedModules.join(", ")}
            </p>
          </div>
          {done ? (
            <Link className="btn btn-primary" href={`/scans/${scanId}/report`}>
              Ver relatório
            </Link>
          ) : null}
        </div>

        <div
          style={{
            height: 8,
            background: "#0a100d",
            borderRadius: 99,
            overflow: "hidden",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #1f8f5a, #3dd68c)",
              transition: "width 0.35s ease",
            }}
          />
        </div>

        <div>
          {moduleOrder.map((mod) => (
            <div key={mod.id} style={{ marginBottom: "0.85rem" }}>
              <div className="module-section-title">{mod.name}</div>
              {mod.checks.map((check) => {
                const state = states[check.id] || { status: "pending" };
                return (
                  <div className="check-row" key={check.id}>
                    <div style={{ paddingTop: 2 }}>
                      {state.status === "running" ? (
                        <div className="spinner" />
                      ) : (
                        <span className={`status-pill status-${state.status}`}>
                          {state.status}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        <span className="mono muted">{check.owaspId}</span>{" "}
                        {check.name}
                      </div>
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        {check.mode === "assisted"
                          ? "Assistido · "
                          : "Automático · "}
                        {state.message || "Aguardando…"}
                      </div>
                    </div>
                    <div className="muted mono" style={{ fontSize: "0.75rem" }}>
                      {check.mode}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Log de execução</h3>
        <div className="log-panel">
          {logs.length === 0 ? (
            <div>Aguardando eventos do scanner…</div>
          ) : (
            logs.map((line, i) => (
              <div key={`${line.at}-${i}`}>
                <span className="muted">
                  [{new Date(line.at).toLocaleTimeString()}]
                </span>{" "}
                {line.message}
              </div>
            ))
          )}
        </div>
        {done ? (
          <p style={{ marginBottom: 0, marginTop: "1rem" }}>
            <Link href={`/scans/${scanId}/report`} className="btn btn-primary">
              Abrir relatório completo
            </Link>
          </p>
        ) : (
          <p
            className="muted"
            style={{ marginBottom: 0, marginTop: "1rem", fontSize: "0.85rem" }}
          >
            Os módulos selecionados rodam no servidor. Esta tela atualiza via
            SSE.
          </p>
        )}
      </div>
    </div>
  );
}
