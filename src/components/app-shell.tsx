"use client";

import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
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

const sidebarStorageKey = "upco-sidebar-collapsed";
const sidebarChangeEvent = "upco-sidebar-change";
let fallbackCollapsed = false;

function sidebarSnapshot() {
  try { return window.localStorage.getItem(sidebarStorageKey) === "true"; }
  catch { return fallbackCollapsed; }
}

function subscribeSidebar(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(sidebarChangeEvent, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(sidebarChangeEvent, notify);
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeSidebar, sidebarSnapshot, () => false);
  const toggleSidebar = () => {
    const next = !collapsed;
    try { window.localStorage.setItem(sidebarStorageKey, String(next)); }
    catch { fallbackCollapsed = next; }
    window.dispatchEvent(new Event(sidebarChangeEvent));
  };
  return (
    <div className="app-frame">
      <aside className={`sidebar${collapsed ? " is-collapsed" : ""}`}>
        <Link href="/inicio" className="brand" aria-label="UPCO Admin, ir a Inicio">
          <Image src="/brand/upco-logo-light.png" alt="" width={226} height={93} className="brand-logo brand-logo-expanded" priority />
          <Image src="/brand/logo-upco-blanco.png" alt="" width={863} height={1260} className="brand-logo brand-logo-collapsed" loading="lazy" />
        </Link>
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-expanded={!collapsed} aria-controls="main-navigation">
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span><span className="sidebar-toggle-label">{collapsed ? "Expandir" : "Contraer"}</span>
        </button>
        <p className="nav-caption">ESPACIO DE TRABAJO</p>
        <nav id="main-navigation" aria-label="Navegación principal" className="main-nav">
          {navigation.map(({ href, label, icon }) => <Link key={href} href={href} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}><span aria-hidden="true">{icon}</span><span className="nav-label">{label}</span></Link>)}
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
