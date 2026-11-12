import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus } from "@/features/administration/reports/status";
import { requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

export default async function ReportesAdministracionPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["reports.export"]);
  const status = await loadAdministrationDraftStatus(access);
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">CIERRE FISCAL</span><h1>Reportes y exportaciones</h1><p>Indicadores operativos de borradores administrativos.</p></div>
    {status.error ? <p className="error-message">No se pudo cargar el resumen. Aplica las migraciones de Administración V2.</p> : <section className="work-card">
      <h2>Compras en borrador</h2><dl className="detail-grid">
        <div><dt>Total</dt><dd>{status.total}</dd></div><div><dt>Facturas</dt><dd>{status.invoices}</dd></div>
        <div><dt>Notas de crédito</dt><dd>{status.creditNotes}</dd></div><div><dt>Notas de débito</dt><dd>{status.debitNotes}</dd></div>
      </dl>
    </section>}
    <section className="work-card">
      <h2>Declaraciones</h2>
      <p>Los archivos se generan a partir de documentos emitidos y snapshots fiscales. Valida el período y la conciliación antes de presentar en SENIAT.</p>
      <div className="administration-export-grid">
        <form action="/api/administracion/exportaciones/iva-txt" method="get" className="work-form">
          <h3>TXT de retenciones IVA</h3>
          <label className="field">Período<input type="month" name="period" required /></label>
          <label className="field">Quincena<select name="half" required defaultValue=""><option value="" disabled>Selecciona</option><option value="1">1–15</option><option value="2">16–fin de mes</option></select></label>
          <button className="primary-button" type="submit">Generar TXT</button>
        </form>
        <form action="/api/administracion/exportaciones/islr-xml" method="get" className="work-form">
          <h3>XML mensual ISLR</h3>
          <label className="field">Período<input type="month" name="period" required /></label>
          <button className="primary-button" type="submit">Generar XML</button>
        </form>
      </div>
      <p>La exportación se detiene si faltan comprobantes o encuentra casos no representables en el formato entregado, como IVA mixto en una misma línea o notas ISLR.</p>
    </section>
    <p className="administration-lock-note">Contabilidad aprobó las reglas y formatos fuente. Los archivos se generan para revisión y este sistema no confirma su aceptación por SENIAT.</p>
  </div>;
}
