import { ImportPreview } from "@/components/administration/import-preview";
import { getAccessContext } from "@/features/auth/access";
import { requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

export default async function ImportacionesPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["imports.validate"]);
  const canImport = access.role === "admin";
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">IMPORTACIÓN HISTÓRICA</span><h1>Importaciones</h1><p>Revisa estructura y contenido de archivos históricos.</p></div>
    <div className="administration-lock-note"><strong>Importación histórica transaccional:</strong> el servidor contrasta proveedores, configuración fiscal, cálculos, duplicados, comprobantes originales y facturas relacionadas al validar y vuelve a hacer esas comprobaciones al confirmar. Si una fila falla, revierte el lote completo. {canImport ? "No crea comprobantes ni nuevos correlativos." : "Tu permiso permite validar; confirmar importaciones sigue reservado a administradores."}</div>
    <ImportPreview canImport={canImport} />
  </div>;
}
