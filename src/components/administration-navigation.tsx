"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import { ADMINISTRATION_NAVIGATION } from "@/features/administration/permissions/catalog";

const icons = {
  "/administracion": LayoutDashboard,
  "/administracion/compras": ClipboardList,
  "/administracion/proveedores": Building2,
  "/administracion/reportes": ChartNoAxesCombined,
  "/administracion/configuracion-fiscal": SlidersHorizontal,
  "/administracion/permisos": UsersRound,
};

type Props = {
  permissions: string[];
  isAdmin: boolean;
  mobile?: boolean;
  collapsed?: boolean;
};

export function AdministrationNavigation({ permissions, isAdmin, mobile = false, collapsed = false }: Props) {
  const pathname = usePathname() ?? "/inicio";
  const searchParams = useSearchParams();
  const isAdministrationRoute = pathname === "/administracion" || pathname.startsWith("/administracion/");
  const [expanded, setExpanded] = useState(isAdministrationRoute);

  const sections = ADMINISTRATION_NAVIGATION.filter((section) =>
    "adminOnly" in section && section.adminOnly
      ? isAdmin
      : isAdmin || section.permissions.some((permission) => permissions.includes(permission)),
  );
  const periodParams = new URLSearchParams();
  for (const key of ["period", "half"]) {
    const value = searchParams.get(key);
    if (value) periodParams.set(key, value);
  }
  const sectionHref = (href: string) => {
    const query = periodParams.toString();
    return query ? `${href}?${query}` : href;
  };
  const parentLink = (
    <Link
      href={sectionHref("/administracion")}
      aria-label={collapsed ? "Administración" : undefined}
      title={collapsed ? "Administración" : undefined}
      className={`admin-nav-parent${isAdministrationRoute ? " is-active" : ""}`}
    >
      <ClipboardList aria-hidden="true" size={18} strokeWidth={1.8} />
      <span className="nav-label">Administración</span>
    </Link>
  );
  const toggle = (
    <button
      type="button"
      className="admin-nav-toggle"
      aria-label={expanded ? "Contraer submódulos de Administración" : "Expandir submódulos de Administración"}
      aria-expanded={expanded}
      aria-controls={mobile ? "mobile-administration-links" : "administration-links"}
      onClick={() => setExpanded((current) => !current)}
      title={collapsed ? (expanded ? "Contraer Administración" : "Expandir Administración") : undefined}
    >
      <ChevronDown aria-hidden="true" size={16} />
    </button>
  );

  return (
    <div className={`admin-nav-group${isAdministrationRoute ? " is-current" : ""}${mobile ? " is-mobile" : ""}`}>
      <div className="admin-nav-parent-row">{mobile ? <SheetClose asChild>{parentLink}</SheetClose> : parentLink}{toggle}</div>
      <ul id={mobile ? "mobile-administration-links" : "administration-links"} className="admin-nav-children" aria-label="Submódulos de Administración" hidden={!expanded}>
          {sections.map((section) => {
            const active = "exact" in section && section.exact
              ? pathname === section.href
              : pathname === section.href || pathname.startsWith(`${section.href}/`);
            const Icon = icons[section.href as keyof typeof icons];
            const link = (
              <Link
                href={sectionHref(section.href)}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? section.label : undefined}
                title={collapsed ? section.label : undefined}
                className={`admin-nav-child${active ? " is-active" : ""}`}
              >
                {Icon && <Icon aria-hidden="true" size={17} strokeWidth={1.8} />}
                <span className="nav-label">{section.label}</span>
              </Link>
            );
            return <li key={section.href}>{mobile ? <SheetClose asChild>{link}</SheetClose> : link}</li>;
          })}
      </ul>
    </div>
  );
}
