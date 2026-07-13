"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          name: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha na autenticação");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card stack fade-up" onSubmit={onSubmit} style={{ maxWidth: 420, margin: "4rem auto" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>OWASP Scan Lab</h1>
        <p className="muted" style={{ marginTop: "0.4rem" }}>
          Acompanhe checks do Top 10 ao vivo e gere relatórios.
        </p>
      </div>

      {mode === "register" ? (
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input
          id="password"
          className="input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="mínimo 6 caracteres"
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Criar uma conta" : "Já tenho conta"}
      </button>
    </form>
  );
}
