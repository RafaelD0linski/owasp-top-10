import { SecurityCheck } from "../types";
import { checkSecurityHeaders } from "./security-headers";
import {
  checkCookieFlags,
  checkVerboseErrors,
} from "./misconfiguration";
import { checkReflectedXss, checkSqliHeuristic } from "./injection";
import { checkWeakAuth } from "./weak-auth";
import {
  checkBrokenAccessControlAssisted,
  checkInsecureDesignAssisted,
} from "./assisted";

export const checks: SecurityCheck[] = [
  {
    id: "broken-access-control",
    owaspId: "A01",
    name: "Broken Access Control",
    mode: "assisted",
    description: "Checklist assistido de IDOR e autorização por objeto.",
    run: checkBrokenAccessControlAssisted,
  },
  {
    id: "security-headers",
    owaspId: "A05",
    name: "Security Headers",
    mode: "auto",
    description: "Verifica headers de segurança HTTP (CSP, XFO, HSTS, etc.).",
    run: checkSecurityHeaders,
  },
  {
    id: "cookie-flags",
    owaspId: "A05",
    name: "Cookie Flags",
    mode: "auto",
    description: "Analisa HttpOnly, Secure e SameSite em cookies.",
    run: checkCookieFlags,
  },
  {
    id: "verbose-errors",
    owaspId: "A05",
    name: "Verbose Errors",
    mode: "auto",
    description: "Detecta stack traces e erros SQL expostos.",
    run: checkVerboseErrors,
  },
  {
    id: "reflected-xss",
    owaspId: "A03",
    name: "Reflected XSS",
    mode: "auto",
    description: "Probe de XSS refletido em parâmetros comuns.",
    run: checkReflectedXss,
  },
  {
    id: "sqli-heuristic",
    owaspId: "A03",
    name: "SQL Injection (heurística)",
    mode: "auto",
    description: "Probes seguros que buscam erros SQL em respostas.",
    run: checkSqliHeuristic,
  },
  {
    id: "weak-auth",
    owaspId: "A07",
    name: "Identification & Authentication Failures",
    mode: "auto",
    description: "Credenciais padrão e ausência aparente de rate limit.",
    run: checkWeakAuth,
  },
  {
    id: "insecure-design",
    owaspId: "A04",
    name: "Insecure Design",
    mode: "assisted",
    description: "Perguntas guiadas sobre threat modeling e limites de negócio.",
    run: checkInsecureDesignAssisted,
  },
];

export function getCheckCatalog() {
  return checks.map(({ id, owaspId, name, mode, description }) => ({
    id,
    owaspId,
    name,
    mode,
    description,
  }));
}
