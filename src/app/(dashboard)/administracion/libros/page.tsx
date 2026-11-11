import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus } from "@/features/administration/reports/status";

export default async function LibrosPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const status = await loadAdministrationDraftStatus(access);
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.4</span><h1>Libros y cierres</h1><p>Estado de borradores por período y conciliación.</p></div>
    {status.error ? <p className="error-message">No se pudo cargar el estado de libros. Aplica las migraciones de Administración V2.</p> : <section className="work-card">
      <h2>Estado actual</h2><dl className="detail-grid">
        <div><dt>Borradores</dt><dd>{status.total}</dd></div><div><dt>Períodos con datos</dt><dd>{status.periods}</dd></div>
        <div><dt>Facturas</dt><dd>{status.invoices}</dd></div><div><dt>Notas de crédito</dt><dd>{status.creditNotes}</dd></div><div><dt>Notas de débito</dt><dd>{status.debitNotes}</dd></div>
      </dl>
    </section>}
    <section className="work-card">
      <h2>Cierre contable XLSX</h2>
      <p>Distribuye documentos emitidos según sus fechas de pago/abono y CECO.</p>
      <form action="/api/administracion/exportaciones/cierre-xlsx" method="get" className="work-form">
        <label className="field">Desde<input type="date" name="from" required /></label>
        <label className="field">Hasta<input type="date" name="to" required /></label>
        <button className="primary-button" type="submit">Generar cierre XLSX</button>
      </form>
    </section>
    <section className="work-card">
      <h2>Libro de compras XLSX</h2>
      <p>Genera las hojas Compras y Distribución contable con las bases IVA separadas y los snapshots de cuenta/CECO del documento emitido.</p>
      <form action="/api/administracion/exportaciones/libro-xlsx" method="get" className="work-form">
        <label className="field">Período<input type="month" name="period" required /></label>
        <label className="field">Quincena<select name="half" defaultValue=""><option value="">Mes completo</option><option value="1">1–15</option><option value="2">16–fin de mes</option></select></label>
        <button className="primary-button" type="submit">Generar libro XLSX</button>
      </form>
    </section>
    <section className="work-card">
      <h2>Formato descrito por la entrega</h2>
      <p>Contabilidad aprobó el formato fuente: hojas <strong>Compras</strong> y <strong>Distribución contable</strong>, bases e IVA 16 %/8 % separados y distribución por descripción, cuenta y CECO.</p>
      <p>El cierre aprobado se arma por rango inclusivo de fechas de pago/abono y distribución por CECO.</p>
    </section>
    <p className="administration-lock-note">El libro y cierre XLSX se generan a partir de documentos emitidos para revisión. Los archivos no representan un cierre contable final ni confirman aceptación por parte de terceros.</p>
  </div>;
}
