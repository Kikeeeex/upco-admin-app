"use client";

import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export function AdministrationHeaderControls({ isAdmin, userLabel }: { isAdmin: boolean; userLabel: string }) {
  const pathname = usePathname() ?? "/administracion";
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? currentPeriod();

  function updatePeriod(nextPeriod: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextPeriod)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", nextPeriod);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return <div className="administration-header-controls">
    <label className="administration-period-control">
      <CalendarDays aria-hidden="true" size={17} />
      <span className="sr-only">Período de Administración</span>
      <input type="month" aria-label="Período" value={period} onChange={(event) => updatePeriod(event.target.value)} />
    </label>
    <span className="administration-user-pill"><span aria-hidden="true" />{userLabel} · {isAdmin ? "Master" : "Usuario"}</span>
  </div>;
}
