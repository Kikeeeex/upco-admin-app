export const PERMISSIONS = [
  "documents.create", "documents.edit", "documents.issue", "documents.delete",
  "vendors.manage", "exports.run", "imports.run", "catalogs.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type UserRole = "master" | "operator";
export type UserAccess = { role: UserRole; permissions: Permission[] };

export function parsePermissions(value: string): Permission[] {
  try {
    const values: unknown = JSON.parse(value);
    return Array.isArray(values) ? values.filter((item): item is Permission =>
      typeof item === "string" && PERMISSIONS.includes(item as Permission)) : [];
  } catch { return []; }
}

export function hasPermission(user: UserAccess, permission: Permission): boolean {
  return user.role === "master" || user.permissions.includes(permission);
}
