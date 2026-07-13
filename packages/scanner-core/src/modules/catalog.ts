import type { SecurityCheck } from "../types";
import { checks as securityChecks } from "../checks";
import { loadChecks } from "./load";
import { networkChecks } from "./network";
import { disasterRecoveryChecks } from "./disaster-recovery";

export type TestModuleId =
  | "security"
  | "load"
  | "network"
  | "disaster-recovery";

export interface TestModule {
  id: TestModuleId;
  name: string;
  shortName: string;
  description: string;
  toolsHint: string;
  checks: SecurityCheck[];
}

export const TEST_MODULES: TestModule[] = [
  {
    id: "security",
    name: "Teste de Segurança (Pentest)",
    shortName: "Segurança",
    description:
      "Identifica vulnerabilidades web (OWASP Top 10) com probes seguros — visão educacional similar a ZAP/Burp em escala reduzida.",
    toolsHint: "Referência de mercado: OWASP ZAP, Burp Suite",
    checks: securityChecks,
  },
  {
    id: "load",
    name: "Teste de Carga e Estresse",
    shortName: "Carga",
    description:
      "Avalia o comportamento sob pico de requisições HTTP (latência, erros, taxa de sucesso) para reduzir risco de queda.",
    toolsHint:
      "Referência de mercado: k6, JMeter, Gatling (monitoramento: Icinga/Nagios)",
    checks: loadChecks,
  },
  {
    id: "network",
    name: "Testes de Rede e Conectividade",
    shortName: "Rede",
    description:
      "Verifica DNS, tempo de conexão TCP e latência HTTP (camadas de aplicativo/transporte acessíveis deste scanner).",
    toolsHint:
      "Referência de mercado: iPerf (banda), mtr/ping (perda) — aqui: diagnóstico HTTP/TCP",
    checks: networkChecks,
  },
  {
    id: "disaster-recovery",
    name: "Disaster Recovery (Recuperação)",
    shortName: "DR",
    description:
      "Checklist assistido para validar backups, RTO/RPO e capacidade de restaurar após falhas graves.",
    toolsHint: "Complementa drills manuais de restore e planos de continuidade",
    checks: disasterRecoveryChecks,
  },
];

export function getModuleCatalog() {
  return TEST_MODULES.map(
    ({ id, name, shortName, description, toolsHint, checks }) => ({
      id,
      name,
      shortName,
      description,
      toolsHint,
      checkCount: checks.length,
      checks: checks.map(
        ({ id: checkId, owaspId, name: checkName, mode, description: d }) => ({
          id: checkId,
          owaspId,
          name: checkName,
          mode,
          description: d,
          moduleId: id,
        })
      ),
    })
  );
}

export function resolveChecksForModules(
  moduleIds: TestModuleId[]
): SecurityCheck[] {
  const selected = new Set(moduleIds);
  const list: SecurityCheck[] = [];
  for (const mod of TEST_MODULES) {
    if (selected.has(mod.id)) {
      list.push(...mod.checks);
    }
  }
  return list;
}

export function normalizeModuleIds(input?: string[] | null): TestModuleId[] {
  const valid = new Set(TEST_MODULES.map((m) => m.id));
  const raw = (input || []).filter((id): id is TestModuleId =>
    valid.has(id as TestModuleId)
  );
  if (raw.length === 0) return ["security"];
  return [...new Set(raw)];
}
