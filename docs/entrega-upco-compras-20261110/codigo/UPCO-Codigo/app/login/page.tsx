"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "No se pudo iniciar sesión."); return; }
      window.location.replace("/");
    } catch { setError("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <img className="login-logo" src="/upco-logo-green.png" alt="UPCO de Venezuela" />
      <div>
        <p className="login-eyebrow">PLATAFORMA INTERNA</p>
        <h1 className="login-heading">Compras y retenciones</h1>
        <p className="login-copy">Ingresa para continuar con la gestión de UPCO de Venezuela.</p>
      </div>
      <label className="login-field">Usuario<input className="login-input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required /></label>
      <label className="login-field">Contraseña<input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="login-submit" disabled={busy} type="submit">{busy ? "Ingresando…" : "Ingresar"}</button>
      <p className="login-footer">UPCO de Venezuela · Gestión fiscal</p>
    </form>
  </main>;
}
