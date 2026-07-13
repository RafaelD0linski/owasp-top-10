# Deploy com Docker

Este projeto sobe com **Docker Compose**: app web (scanner) + alvo vulnerável interno.

## Pré-requisitos

- Docker + Docker Compose no servidor
- Portas: `3000` (web). O alvo demo fica **só na rede interna** do Compose (mais seguro).

## Subir

Na raiz do repositório:

```bash
cp .env.docker.example .env
# edite AUTH_SECRET com um valor forte

docker compose up -d --build
```

Acesse: `http://SEU_IP:3000` (ou o domínio com proxy reverso).

Logs:

```bash
docker compose logs -f web
```

Parar:

```bash
docker compose down
```

Dados (SQLite) ficam no volume `owasp_web_data`.

## Variáveis importantes

| Variável | Função |
|----------|--------|
| `AUTH_SECRET` | Assinatura de sessão (obrigatório trocar) |
| `DATABASE_URL` | `file:/data/prod.db` (volume) |
| `DEMO_TARGET_URL` | `http://vulnerable-target:4000` (rede Docker) |
| `ALLOWED_SCAN_HOSTS` | Hosts que o scanner pode testar |

## Proxy reverso (Nginx/Caddy) + HTTPS

Aponte o domínio para `localhost:3000`. Exemplo Nginx:

```nginx
server {
  listen 80;
  server_name scan.seudominio.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Depois use Certbot/Caddy para HTTPS.

## Segurança no servidor

- **Não** publique a porta `4000` do `vulnerable-target` na internet (é um app de propósito inseguro).
- Use só alvos autorizados no scanner.
- Troque `AUTH_SECRET`.
- Restrinja `ALLOWED_SCAN_HOSTS`.
- Prefira firewall liberando só 80/443 (e SSH).

## Encaixar no Docker que você já tem

Se já usa um `docker-compose` “pai”:

1. Copie os serviços `web` e `vulnerable-target` para o compose existente, **ou**
2. Use a rede externa:

```yaml
networks:
  owasp_net:
    external: true
    name: sua_rede_existente
```

E suba este stack na mesma rede.

## LinkedIn (portfólio)

Sugestão de post curto:

> Desenvolvi o **OWASP Scan Lab**: plataforma web para testes autorizados (segurança OWASP, carga, rede e disaster recovery), com execução ao vivo, relatório PDF e deploy em Docker.
>
> Stack: Next.js, TypeScript, Prisma/SQLite, scanner modular e Docker Compose.
>
> Foco em aprendizado prático do OWASP Top 10 + boas de correção e risco.
>
> (print do dashboard + link do repo/demo se público)

Dicas: 2–3 prints (dashboard, scan ao vivo, relatório), mencione que é lab educacional e só em alvos autorizados.
