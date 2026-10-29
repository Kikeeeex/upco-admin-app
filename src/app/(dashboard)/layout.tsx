import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { SessionGuard } from "@/components/session-guard";
import { getAccessContext } from "@/features/auth/access";

export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await connection();
  const access = await getAccessContext();
  if (access.kind === "unconfigured" || access.kind === "anonymous") redirect("/login");
  if (access.kind === "expired") redirect("/login?expired=1");
  if (access.kind !== "allowed") redirect("/acceso-denegado");
  return <><SessionGuard signedInAt={access.sessionStartedAt} /><AppShell>{children}</AppShell></>;
}
