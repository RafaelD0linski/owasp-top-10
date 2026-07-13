const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 4000;

const users = [
  { id: 1, name: "Alice", email: "alice@demo.local", role: "user" },
  { id: 2, name: "Bob", email: "bob@demo.local", role: "user" },
  { id: 3, name: "Admin", email: "admin@demo.local", role: "admin" },
];

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type":
      typeof body === "string" ? "text/html; charset=utf-8" : "application/json",
    // Intentionally insecure: missing CSP, XFO, etc.
    "X-Powered-By": "vulnerable-target/0.1",
    ...headers,
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      const ct = req.headers["content-type"] || "";
      if (ct.includes("application/json")) {
        try {
          resolve(JSON.parse(data || "{}"));
        } catch {
          resolve({});
        }
      } else {
        const params = new URLSearchParams(data);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        resolve(obj);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Insecure session cookie on home
  if (path === "/" && req.method === "GET") {
    return send(
      res,
      200,
      `<!doctype html>
<html>
<head><title>Vulnerable Target Demo</title></head>
<body>
  <h1>Alvo vulnerável (demo OWASP)</h1>
  <p>Endpoints de propósito inseguros para demonstração.</p>
  <ul>
    <li><a href="/search?q=teste">/search?q=</a> — XSS refletido</li>
    <li><a href="/users?id=1">/users?id=</a> — SQLi simulada</li>
    <li><a href="/login">/login</a> — auth fraca (admin/admin)</li>
    <li><a href="/users/1">/users/:id</a> — IDOR</li>
  </ul>
</body>
</html>`,
      {
        // Missing HttpOnly / SameSite / Secure on purpose
        "Set-Cookie": "session=demo-insecure-session; Path=/",
      }
    );
  }

  if (path === "/search" || path === "/reflect") {
    const q = url.searchParams.get("q") || url.searchParams.get("input") || "";
    // Reflected XSS on purpose
    return send(
      res,
      200,
      `<!doctype html><html><body><h1>Busca</h1><p>Resultados para: ${q}</p></body></html>`
    );
  }

  if (path === "/users" && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    // Simulated SQL injection error
    if (id.includes("'") || id.includes('"') || /or\s+1=1/i.test(id)) {
      return send(
        res,
        500,
        {
          error: "SQLITE_ERROR",
          message: `SQL syntax error near "${id}" in SELECT * FROM users WHERE id = '${id}'`,
          stack:
            "Error: SQLITE_ERROR\n    at Database.prepare (/app/db.js:42:11)\n    at Object.query (/app/users.js:18:5)",
        }
      );
    }
    const user = users.find((u) => String(u.id) === id);
    return send(res, 200, user || users);
  }

  if (path.startsWith("/users/") && req.method === "GET") {
    const id = path.split("/")[2];
    const user = users.find((u) => String(u.id) === id);
    // IDOR: no auth check
    if (!user) return send(res, 404, { error: "not found" });
    return send(res, 200, user);
  }

  if (path === "/login") {
    if (req.method === "GET") {
      return send(
        res,
        200,
        `<!doctype html><html><body>
          <h1>Login</h1>
          <form method="POST" action="/login">
            <input name="username" placeholder="user" />
            <input name="password" type="password" placeholder="pass" />
            <button>Entrar</button>
          </form>
        </body></html>`
      );
    }
    if (req.method === "POST") {
      const body = await parseBody(req);
      const username = body.username || "";
      const password = body.password || "";
      // No rate limiting on purpose
      if (username === "admin" && password === "admin") {
        return send(
          res,
          200,
          {
            status: "success",
            message: "Welcome admin",
            token: "demo-jwt-insecure",
            authenticated: true,
          },
          {
            "Set-Cookie": "session=admin-session; Path=/",
          }
        );
      }
      return send(res, 401, { status: "error", message: "Invalid credentials" });
    }
  }

  // Verbose 404
  return send(res, 404, {
    error: "Not Found",
    path,
    stack: `TypeError: Cannot read property of undefined\n    at router.handle (/app/server.js:120:9)\n    at Layer.handle (/app/router.js:55:3)`,
    exception: "RouteNotFoundException",
  });
});

server.listen(PORT, () => {
  console.log(`Vulnerable target listening on http://localhost:${PORT}`);
});
