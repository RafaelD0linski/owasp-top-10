import { runScan, normalizeModuleIds, type TestModuleId } from "@owasp/scanner-core";
import type { ScanProgressEvent } from "@owasp/scanner-core";
import { prisma } from "./db";
import { computeScore } from "./scan-utils";

type Listener = (event: ScanProgressEvent & { at?: string }) => void;

const listeners = new Map<string, Set<Listener>>();
const running = new Set<string>();

export function subscribeScan(scanId: string, listener: Listener) {
  if (!listeners.has(scanId)) listeners.set(scanId, new Set());
  listeners.get(scanId)!.add(listener);
  return () => {
    listeners.get(scanId)?.delete(listener);
  };
}

async function emit(scanId: string, event: ScanProgressEvent) {
  const at = new Date().toISOString();
  await prisma.scanEvent.create({
    data: {
      scanId,
      type: event.type,
      checkId: event.checkId,
      owaspId: event.owaspId,
      checkName: event.checkName,
      message: event.message,
      payload: event.findings ? JSON.stringify(event.findings) : null,
    },
  });

  const set = listeners.get(scanId);
  if (set) {
    for (const listener of set) {
      listener({ ...event, at });
    }
  }
}

export async function startScanJob(
  scanId: string,
  targetUrl: string,
  modules?: TestModuleId[]
) {
  if (running.has(scanId)) return;
  running.add(scanId);

  const selectedModules = normalizeModuleIds(modules);

  void (async () => {
    try {
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "running",
          startedAt: new Date(),
          modules: JSON.stringify(selectedModules),
        },
      });

      const findings = await runScan({
        targetUrl,
        modules: selectedModules,
        onEvent: async (event) => {
          await emit(scanId, event);

          if (event.type === "check_done" && event.findings) {
            for (const f of event.findings) {
              await prisma.finding.create({
                data: {
                  scanId,
                  owaspId: f.owaspId,
                  checkId: f.checkId,
                  title: f.title,
                  severity: f.severity,
                  status: f.status,
                  evidence: f.evidence,
                  risk: f.risk,
                  recommendation: f.recommendation,
                },
              });
            }
          }
        },
      });

      const score = computeScore(findings);
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          score,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro no scan";
      await emit(scanId, { type: "scan_error", error: message, message });
      await prisma.scan.update({
        where: { id: scanId },
        data: { status: "failed", finishedAt: new Date() },
      });
    } finally {
      running.delete(scanId);
    }
  })();
}
