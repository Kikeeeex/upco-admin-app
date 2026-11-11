"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { BriefcaseBusiness, ChartNoAxesColumn, ChevronLeft, ChevronRight, ClipboardList, FolderKanban, House, Menu, MonitorCog, PackageSearch, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavigationItem = { href: string; label: string; icon: LucideIcon };
const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: "Trabajo", items: [
    { href: "/inicio", label: "Inicio", icon: House },
    { href: "/mi-trabajo", label: "Mi trabajo", icon: BriefcaseBusiness },
  ] },
  { label: "Áreas", items: [
    { href: "/administracion", label: "Administración", icon: ClipboardList },
    { href: "/procura", label: "Procura", icon: PackageSearch },
    { href: "/ti", label: "Tecnología", icon: MonitorCog },
    { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
  ] },
  { label: "Herramientas", items: [
    { href: "/reportes", label: "Reportes", icon: ChartNoAxesColumn },
    { href: "/configuracion", label: "Configuración", icon: Settings2 },
  ] },
];
const navigation = navigationGroups.flatMap((group) => group.items);

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

function NavigationLinks({ pathname, mobile = false, collapsed = false }: { pathname: string; mobile?: boolean; collapsed?: boolean }) {
  return navigationGroups.map((group) => <div key={group.label} className="nav-group" role="group" aria-label={group.label}>
    <span className="nav-caption" aria-hidden="true">{group.label.toUpperCase()}</span>
    {group.items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      const link = <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}>
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} /><span className="nav-label">{label}</span>
      </Link>;
      return mobile ? <SheetClose asChild key={href}>{link}</SheetClose> : link;
    })}
  </div>);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/inicio";
  const current = navigation.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`)) ?? navigation[0];
  const detailLabel = pathname.startsWith("/procura/proveedores/") ? "Ficha de proveedor"
    : pathname === "/procura/importar" ? "Importar proveedores"
    : pathname.startsWith("/procura/") ? "Ficha de solicitud"
    : pathname.startsWith("/mi-trabajo/") ? "Ficha de actividad"
    : pathname.startsWith("/administracion/") ? "Ficha de Administración" : null;
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
          {collapsed ? <ChevronRight aria-hidden="true" size={18} /> : <ChevronLeft aria-hidden="true" size={18} />}
          <span className="sidebar-toggle-label">{collapsed ? "Expandir" : "Contraer"}</span>
        </button>
        <nav id="main-navigation" aria-label="Navegación principal" className="main-nav">
          <NavigationLinks pathname={pathname} collapsed={collapsed} />
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Entorno de trabajo</div>
      </aside>
      <div className="content-frame">
        <header className="topbar">
          <div className="topbar-location">
            <Sheet>
              <SheetTrigger asChild><Button type="button" variant="ghost" size="icon" className="mobile-menu-trigger" aria-label="Abrir menú"><Menu aria-hidden="true" /></Button></SheetTrigger>
              <SheetContent side="left" className="mobile-menu-panel" showCloseButton>
                <SheetHeader><SheetTitle>Navegación de UPCO Admin</SheetTitle></SheetHeader>
                <nav aria-label="Navegación móvil" className="main-nav mobile-nav"><NavigationLinks pathname={pathname} mobile /></nav>
              </SheetContent>
            </Sheet>
            <div><nav className="topbar-eyebrow topbar-breadcrumb" aria-label="Ruta actual"><Link href="/inicio">UPCO</Link><span aria-hidden="true">/</span>{detailLabel ? <><Link href={current.href}>{current.label}</Link><span aria-hidden="true">/</span><span aria-current="page">{detailLabel}</span></> : <span aria-current="page">{current.label}</span>}</nav><strong>{detailLabel ?? current.label}</strong></div>
          </div>
          <form action="/auth/signout" method="post"><button className="quiet-button" type="submit">Cerrar sesión</button></form>
        </header>
        <main id="contenido" className="main-content">{children}</main>
      </div>
    </div>
  );
}
