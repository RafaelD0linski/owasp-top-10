import { Finding, CheckContext, SecurityCheck } from "../types";

export async function checkBackupStrategy(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("DR assistido: validar estratégia de backup (RPO)…");
  return [
    {
      owaspId: "DR",
      checkId: "dr-backup",
      title: "Estratégia de backup (checklist)",
      severity: "high",
      status: "manual",
      evidence:
        "Confirme: (1) backups automáticos do banco e arquivos; (2) retenção (diário/semanal/mensal); (3) backup offsite/imutable; (4) RPO definido (ex.: perda máx. 1h de dados).",
      risk: "Sem backup testado, uma falha de disco, ransomware ou drop acidental pode causar perda permanente de dados e parada prolongada do negócio.",
      recommendation:
        "Automatize backups, criptografe, armazene fora do ambiente primário e documente o RPO. Teste restore mensalmente. Ferramentas variam (snapshots cloud, pg_dump, Velero, etc.).",
    },
  ];
}

export async function checkRestoreDrill(ctx: CheckContext): Promise<Finding[]> {
  ctx.log("DR assistido: validar restore e RTO…");
  return [
    {
      owaspId: "DR",
      checkId: "dr-restore",
      title: "Drill de restore / RTO (checklist)",
      severity: "high",
      status: "manual",
      evidence:
        "Confirme: (1) já restaurou backup em ambiente isolado nos últimos 90 dias; (2) tempo medido de restore (RTO); (3) runbook escrito; (4) responsáveis e contatos claros.",
      risk: "Backup que nunca foi restaurado costuma falhar na crise. RTO alto sem ensaio gera horas/dias de downtime quando o hardware/software quebra.",
      recommendation:
        "Faça drill periódico de restore, registre duração real vs RTO alvo, automatize provisioning (IaC) e mantenha runbooks atualizados. Valide também DNS/failover e secrets.",
    },
  ];
}

export async function checkFailoverReadiness(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log("DR assistido: prontidão de failover…");
  return [
    {
      owaspId: "DR",
      checkId: "dr-failover",
      title: "Failover e continuidade (checklist)",
      severity: "medium",
      status: "manual",
      evidence:
        "Confirme: (1) ambiente secundário ou multi-AZ; (2) health checks e failover automático/manual ensaiado; (3) dependências críticas mapeadas (DNS, filas, storage).",
      risk: "Sem failover ensaiado, uma AZ/região ou VM única derruba todo o serviço. Continuação depende de improvisação sob pressão.",
      recommendation:
        "Desenhe arquitetura multi-AZ, teste failover, monitore com Icinga/Nagios/Prometheus e alinhe DR com testes de carga e segurança.",
    },
  ];
}

export const disasterRecoveryChecks: SecurityCheck[] = [
  {
    id: "dr-backup",
    owaspId: "DR",
    name: "Backups e RPO",
    mode: "assisted",
    description: "Checklist de backups, retenção e objetivo de ponto de recuperação.",
    run: checkBackupStrategy,
  },
  {
    id: "dr-restore",
    owaspId: "DR",
    name: "Restore e RTO",
    mode: "assisted",
    description: "Checklist de drills de restore e tempo de recuperação.",
    run: checkRestoreDrill,
  },
  {
    id: "dr-failover",
    owaspId: "DR",
    name: "Failover / continuidade",
    mode: "assisted",
    description: "Checklist de prontidão de failover e dependências críticas.",
    run: checkFailoverReadiness,
  },
];
