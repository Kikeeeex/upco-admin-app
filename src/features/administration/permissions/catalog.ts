export const ADMINISTRATION_PERMISSIONS = [
  "purchases.read", "purchases.manage", "vendors.read", "vendors.manage", "retentions.read",
  "books.read", "imports.validate", "reports.export", "fiscal_settings.read", "fiscal_settings.manage",
] as const;

export type AdministrationPermission = typeof ADMINISTRATION_PERMISSIONS[number];

export const ADMINISTRATION_PERMISSION_OPTIONS: { key: AdministrationPermission; label: string; description: string }[] = [
  { key: "purchases.read", label: "Consultar compras", description: "Ver documentos y sus fichas." },
  { key: "purchases.manage", label: "Gestionar borradores", description: "Crear y editar borradores; no emitir ni anular." },
  { key: "vendors.read", label: "Consultar proveedores", description: "Ver el directorio fiscal." },
  { key: "vendors.manage", label: "Gestionar proveedores", description: "Crear y editar fichas fiscales." },
  { key: "retentions.read", label: "Consultar retenciones", description: "Ver estados de retenciones." },
  { key: "books.read", label: "Consultar libros y cierres", description: "Ver estados contables; no descargar reportes." },
  { key: "imports.validate", label: "Validar importaciones", description: "Revisar archivos sin importar documentos." },
  { key: "reports.export", label: "Reportes y exportaciones", description: "Consultar documentos y descargar salidas." },
  { key: "fiscal_settings.read", label: "Consultar configuración fiscal", description: "Ver propuestas y configuración activa." },
  { key: "fiscal_settings.manage", label: "Proponer configuración fiscal", description: "Crear propuestas; no activarlas." },
];

export const ADMINISTRATION_NAVIGATION = [
  { href: "/administracion", label: "Resumen", exact: true, permissions: ADMINISTRATION_PERMISSIONS },
  { href: "/administracion/compras", label: "Compras y documentos", permissions: ["purchases.read", "purchases.manage"] },
  { href: "/administracion/proveedores", label: "Proveedores", permissions: ["vendors.read", "vendors.manage"] },
  { href: "/administracion/retenciones", label: "Retenciones", permissions: ["retentions.read"] },
  { href: "/administracion/libros", label: "Libros y cierres", permissions: ["books.read"] },
  { href: "/administracion/importaciones", label: "Importaciones", permissions: ["imports.validate"] },
  { href: "/administracion/reportes", label: "Reportes y exportaciones", permissions: ["reports.export"] },
  { href: "/administracion/configuracion-fiscal", label: "Configuración fiscal", permissions: ["fiscal_settings.read", "fiscal_settings.manage"] },
] as const;

export function isAdministrationPermission(value: string): value is AdministrationPermission {
  return (ADMINISTRATION_PERMISSIONS as readonly string[]).includes(value);
}
