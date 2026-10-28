const protectedRoots = [
  "/inicio", "/mi-trabajo", "/administracion", "/procura", "/ti",
  "/proyectos", "/seguimientos", "/reportes", "/configuracion",
];

export function isProtectedPath(pathname: string): boolean {
  return protectedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
