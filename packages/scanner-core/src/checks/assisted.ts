import { Finding, CheckContext } from "../types";

export async function checkBrokenAccessControlAssisted(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log(
    "A01 Broken Access Control é assistido: valide IDOR e roles manualmente."
  );
  return [
    {
      owaspId: "A01",
      checkId: "broken-access-control",
      title: "Broken Access Control (verificação assistida)",
      severity: "high",
      status: "manual",
      evidence:
        "Checklist: (1) Acesse /users/1 e /users/2 trocando IDs sem mudar a sessão. (2) Tente ações de admin sem role. (3) Verifique se APIs respeitam ownership do recurso.",
      risk: "Controle de acesso quebrado (IDOR/escalada de privilégio) permite ler ou alterar dados de outros usuários, incluindo PII, pedidos, documentos e funções administrativas. É o item #1 do OWASP Top 10 por frequência e impacto.",
      recommendation:
        "No servidor (nunca só no frontend): autorize cada ação por usuário/objeto (deny by default). Ex.: só retorne o pedido se order.userId === session.userId. Use roles/permissions centralizadas. Evite IDs previsíveis sem checagem. Teste IDOR em CI. No alvo demo, /users/:id não valida autenticação — corrija exigindo sessão e ownership/role.",
    },
  ];
}

export async function checkInsecureDesignAssisted(
  ctx: CheckContext
): Promise<Finding[]> {
  ctx.log(
    "A04 Insecure Design é assistido: revise ameaças e limites de negócio."
  );
  return [
    {
      owaspId: "A04",
      checkId: "insecure-design",
      title: "Insecure Design (verificação assistida)",
      severity: "medium",
      status: "manual",
      evidence:
        "Perguntas: Há threat model? Limites de negócio (ex.: transferências, reset de senha) são enforced no backend? Fluxos sensíveis têm step-up auth / confirmação?",
      risk: "Falhas de design não se resolvem só com patch pontual: fluxos mal pensados (ex.: reset de senha fraco, cupons ilimitados, APIs públicas demais) geram abuso sistemático, fraude e perda financeira mesmo com código 'limpo'.",
      recommendation:
        "Faça modelagem de ameaças (STRIDE/abuse cases) nos fluxos críticos. Defina limites no backend (rate, quotas, valores máximos). Exija reautenticação para ações sensíveis. Revise com segurança antes de features novas — não só depois do código pronto.",
    },
  ];
}
