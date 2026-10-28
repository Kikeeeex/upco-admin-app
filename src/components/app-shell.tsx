import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

const navigation = [
  { href: "/inicio", label: "Inicio", icon: "◫" },
  { href: "/mi-trabajo", label: "Mi trabajo", icon: "☷" },
  { href: "/administracion", label: "Administración", icon: "▤" },
  { href: "/procura", label: "Procura", icon: "◇" },
  { href: "/ti", label: "Tecnología", icon: "⌘" },
  { href: "/proyectos", label: "Proyectos", icon: "▥" },
  { href: "/seguimientos", label: "Seguimientos", icon: "◎" },
  { href: "/reportes", label: "Reportes", icon: "▧" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/inicio" className="brand" aria-label="UPCO Admin, ir a Inicio">
          <Image src="/brand/upco-logo-light.png" alt="" width={226} height={93} className="brand-logo" priority />
        </Link>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal" className="main-nav">
          {navigation.map(({ href, label, icon }) => <Link key={href} href={href}><span aria-hidden="true">{icon}</span>{label}</Link>)}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Entorno de trabajo</div>
      </aside>
      <div className="content-frame">
        <header className="topbar">
          <div><span className="topbar-eyebrow">UPCO / ADMINISTRACIÓN</span><strong>Panel de trabajo</strong></div>
          <form action="/auth/signout" method="post"><button className="quiet-button" type="submit">Cerrar sesión</button></form>
        </header>
        <main id="contenido" className="main-content">{children}</main>
      </div>
    </div>
  );
}
