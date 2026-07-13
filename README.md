# OWASP Scan Lab

Aplicação web educacional para demonstrar testes do OWASP Top 10 em tempo real e gerar relatórios.

## O que faz

- Login/cadastro simples
- Scan autorizado (hosts em `ALLOWED_SCAN_HOSTS`, padrão: localhost)
- Progresso ao vivo via SSE (cada check aparece na tela)
- Relatório com score, evidências e download JSON/HTML
- Alvo demo vulnerável em `apps/vulnerable-target`

## Pré-requisitos

- Node.js 20+
- Dois terminais (web + alvo demo)

## Setup

```bash
npm install
npm run build -w @owasp/scanner-core
npm run db:push -w web
```

Copie/ajuste `apps/web/.env` se necessário:

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="troque-em-producao"
DEMO_TARGET_URL="http://localhost:4000"
ALLOWED_SCAN_HOSTS="localhost,127.0.0.1"
```

## Rodar

Terminal 1 — alvo vulnerável:

```bash
npm run dev:target
```

Terminal 2 — app web:

```bash
npm run dev
```

Abra http://localhost:3000 → crie uma conta → **Novo scan** → escolha os módulos → **Rodar demo**.

## Docker (servidor)

```bash
cp .env.docker.example .env
docker compose up -d --build
```

Detalhes, proxy HTTPS e LinkedIn: veja [DEPLOY.md](./DEPLOY.md).

## Estrutura

```
apps/web                 # Next.js (UI + API + SSE + Prisma/SQLite)
apps/vulnerable-target   # Mini app propositalmente inseguro
packages/scanner-core    # Motor de checks OWASP
```

## Checks do MVP

Módulos selecionáveis no formulário de novo teste:

- **Segurança (Pentest):** headers, cookies, erros verbosos, XSS, SQLi, auth fraca + A01/A04 assistidos
- **Carga e Estresse:** baseline HTTP + pico concorrente (latência/erros)
- **Rede:** DNS, TCP e latência HTTP
- **Disaster Recovery:** checklists de backup (RPO), restore (RTO) e failover

Relatório com risco, como corrigir, PDF e filtro por módulo.

## Deploy (Docker)

Sim — encaixa no servidor que já usa Docker:

```bash
cp .env.docker.example .env
docker compose up -d --build
```

Guia completo (proxy HTTPS, rede Docker existente, LinkedIn): [DEPLOY.md](./DEPLOY.md).

## Aviso legal

Use apenas em sistemas que você possui ou tem autorização por escrito.
