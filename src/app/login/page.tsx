import { LoginButton } from "@/components/login-button";
import Image from "next/image";
import { connection } from "next/server";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  await connection();
  const expired = (await searchParams).expired === "1";
  const url = process.env.SUPABASE_URL ?? null;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? null;
  const configured = Boolean(url && publishableKey && process.env.ENTRA_TENANT_ID);
  return <main className="login-layout">
    <div className="login-side"><div className="login-brand"><strong>UPCO Admin</strong></div><div><span className="eyebrow light">UN ESPACIO PARA TRABAJAR MEJOR</span><h1>Todo lo importante,<br />en un solo lugar.</h1><p>Organiza tus actividades, proyectos y seguimientos con claridad.</p></div><small>UPCO de Venezuela Consultores S.A.</small></div>
    <div className="login-main"><div className="login-card"><Image src="/brand/upco-logo-green.png" alt="UPCO de Venezuela" width={252} height={102} className="login-logo" priority /><span className="eyebrow">ACCESO SEGURO</span><h2>Bienvenido de nuevo</h2><p>Ingresa con tu cuenta corporativa autorizada para continuar.</p>{expired && <p className="setup-note" role="status">Tu sesión terminó por inactividad o al cumplir 8 horas. Entra de nuevo para continuar.</p>}<LoginButton url={configured ? url : null} publishableKey={configured ? publishableKey : null} />{!configured && <p className="setup-note">El acceso estará disponible cuando se configure el proyecto de desarrollo autorizado.</p>}<div className="login-footnote">El acceso requiere identidad Microsoft, tenant aprobado y pertenencia activa.</div></div></div>
  </main>;
}
