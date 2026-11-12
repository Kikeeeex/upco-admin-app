import "server-only";
import { redirect } from "next/navigation";
import type { getAccessContext } from "@/features/auth/access";
import type { AdministrationPermission } from "./catalog";

type AllowedAccess = Extract<Awaited<ReturnType<typeof getAccessContext>>, { kind: "allowed" }>;

export function hasAdministrationPermission(access: AllowedAccess, permission: AdministrationPermission): boolean {
  return access.role === "admin" || access.permissions.includes(permission);
}

export function hasAnyAdministrationPermission(access: AllowedAccess, permissions: readonly AdministrationPermission[]): boolean {
  return access.role === "admin" || permissions.some((permission) => access.permissions.includes(permission));
}

export function requireAnyAdministrationPermission(access: AllowedAccess, permissions: readonly AdministrationPermission[]): void {
  if (!hasAnyAdministrationPermission(access, permissions)) redirect("/administracion/sin-permiso");
}
