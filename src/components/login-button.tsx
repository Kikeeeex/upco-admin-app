"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function LoginButton({ url, publishableKey }: { url: string | null; publishableKey: string | null }) {
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!url || !publishableKey) return;
    const supabase = createBrowserClient(url, publishableKey);
    const result = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "email" },
    });
    if (result.error) setError("No se pudo iniciar sesión. Inténtalo de nuevo o consulta al administrador.");
  }

  return <>
    <button className="primary-button" type="button" onClick={signIn} disabled={!url || !publishableKey}>Entrar con Microsoft <span aria-hidden="true">→</span></button>
    {error && <p role="alert" className="error-message">{error}</p>}
  </>;
}
