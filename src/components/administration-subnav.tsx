"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections: { href: string; label: string; exact?: boolean }[] = [
  { href: "/administracion", label: "Resumen", exact: true },
  { href: "/administracion/compras", label: "Compras y documentos" },
  { href: "/administracion/proveedores", label: "Proveedores" },
  { href: "/administracion/retenciones", label: "Retenciones" },
  { href: "/administracion/libros", label: "Libros y cierres" },
  { href: "/administracion/importaciones", label: "Importaciones" },
  { href: "/administracion/reportes", label: "Reportes y exportaciones" },
  { href: "/administracion/configuracion-fiscal", label: "Configuración fiscal" },
] as const;

export function AdministrationSubnav() {
  const pathname = usePathname();
  return <nav className="administration-subnav" aria-label="Secciones de Administración">
    {sections.map(({ href, label, exact }) => {
      const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}>{label}</Link>;
    })}
  </nav>;
}
