import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus } from "@/features/administration/reports/status";
import { requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

export default async function RetencionesPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["retentions.read"]);
  const status = await loadAdministrationDraftStatus(access);
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.8</span><h1>Retenciones</h1><p>Control de retenciones IVA, ISLR e IGTF registradas en compras.</p></div>
    <section className="work-card">
      <h2>Reglas aprobadas</h2>
      <dl className="detail-grid">
        <div><dt>IVA</dt><dd>Alícuotas 16 % y 8 %; retención configurada de 0 %, 75 % o 100 % sobre IVA.</dd></div>
        <div><dt>ISLR</dt><dd>Catálogo de 86 conceptos, con cálculo automático o base/alícuota/sustraendo manual justificado.</dd></div>
        <div><dt>IGTF</dt><dd>3 % sobre la base indicada; se suma al neto a pagar.</dd></div>
      </dl>
    </section>
    {status.error ? <p className="error-message">No se pudo cargar el estado de retenciones. Aplica las migraciones de Administración V2.</p> : <div className="overview-grid administration-metrics">
      <section className="overview-card"><span className="badge">{status.issued}</span><h2>Documentos emitidos</h2><p>Cálculos y comprobantes quedaron fijados al momento de emisión.</p></section>
      <section className="overview-card"><span className="badge">{status.islrMarked}</span><h2>ISLR en borradores</h2><p>Documentos pendientes de emisión con ISLR marcado.</p></section>
      <section className="overview-card"><span className="badge">{status.igtfMarked}</span><h2>IGTF en borradores</h2><p>Documentos pendientes de emisión con IGTF marcado.</p></section>
    </div>}
    <p className="administration-lock-note">Los archivos de declaración se generan desde Reportes y exportaciones a partir de documentos emitidos. Revisa sus alertas antes de presentar; el sistema no confirma aceptación del portal tributario.</p>
  </div>;
}
