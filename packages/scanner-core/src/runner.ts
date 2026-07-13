import { checks } from "./checks";
import {
  CheckContext,
  Finding,
  SecurityCheck,
  normalizeTargetUrl,
} from "./types";
import {
  normalizeModuleIds,
  resolveChecksForModules,
  type TestModuleId,
} from "./modules/catalog";

export interface ScanProgressEvent {
  type: "check_start" | "check_log" | "check_done" | "scan_done" | "scan_error";
  checkId?: string;
  owaspId?: string;
  checkName?: string;
  message?: string;
  findings?: Finding[];
  error?: string;
}

export interface RunScanOptions {
  targetUrl: string;
  fetchImpl?: typeof fetch;
  onEvent?: (event: ScanProgressEvent) => void | Promise<void>;
  signal?: AbortSignal;
  checksToRun?: SecurityCheck[];
  modules?: TestModuleId[];
}

export async function runScan(options: RunScanOptions): Promise<Finding[]> {
  const targetUrl = normalizeTargetUrl(options.targetUrl);
  const allFindings: Finding[] = [];
  const selected =
    options.checksToRun ||
    resolveChecksForModules(normalizeModuleIds(options.modules));

  // fallback if somehow empty
  const toRun = selected.length > 0 ? selected : checks;

  for (const check of toRun) {
    if (options.signal?.aborted) {
      break;
    }

    await options.onEvent?.({
      type: "check_start",
      checkId: check.id,
      owaspId: check.owaspId,
      checkName: check.name,
      message: `Iniciando ${check.owaspId} — ${check.name}`,
    });

    const ctx: CheckContext = {
      targetUrl,
      fetch: options.fetchImpl || fetch,
      signal: options.signal,
      log: (message) => {
        void options.onEvent?.({
          type: "check_log",
          checkId: check.id,
          owaspId: check.owaspId,
          checkName: check.name,
          message,
        });
      },
    };

    try {
      await new Promise((r) => setTimeout(r, 350));
      const findings = await check.run(ctx);
      allFindings.push(...findings);
      await options.onEvent?.({
        type: "check_done",
        checkId: check.id,
        owaspId: check.owaspId,
        checkName: check.name,
        message: `Concluído: ${check.name}`,
        findings,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      const errorFinding: Finding = {
        owaspId: check.owaspId,
        checkId: check.id,
        title: `Erro ao executar ${check.name}`,
        severity: "info",
        status: "error",
        evidence: message,
        risk: "O check não pôde ser concluído; a ausência de resultado não significa que o alvo seja seguro.",
        recommendation:
          "Verifique se o alvo está acessível, se a URL está correta e se o host está em ALLOWED_SCAN_HOSTS.",
      };
      allFindings.push(errorFinding);
      await options.onEvent?.({
        type: "check_done",
        checkId: check.id,
        owaspId: check.owaspId,
        checkName: check.name,
        message: `Erro: ${message}`,
        findings: [errorFinding],
      });
    }
  }

  await options.onEvent?.({
    type: "scan_done",
    message: "Scan finalizado",
    findings: allFindings,
  });

  return allFindings;
}
