const protectedRoots = [
  "/inicio", "/mi-trabajo", "/administracion", "/procura", "/ti",
  "/proyectos", "/reportes", "/configuracion",
  "/auth/activity",
];

export function isProtectedPath(pathname: string): boolean {
  return protectedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
