"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMINISTRATION_NAVIGATION } from "@/features/administration/permissions/catalog";

export function AdministrationSubnav({ permissions, isAdmin }: { permissions: string[]; isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleSections = ADMINISTRATION_NAVIGATION.filter((section) => isAdmin || section.permissions.some((permission) => permissions.includes(permission)));
  return <nav className="administration-subnav" aria-label="Secciones de Administración">
    {visibleSections.map((section) => {
      const { href, label } = section;
      const active = "exact" in section && section.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}>{label}</Link>;
    })}
    {isAdmin && <Link href="/administracion/permisos" aria-current={pathname === "/administracion/permisos" ? "page" : undefined} className={pathname === "/administracion/permisos" ? "is-active" : undefined}>Permisos</Link>}
  </nav>;
}
