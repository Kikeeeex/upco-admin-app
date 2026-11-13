import { ImportPreview } from "@/components/administration/import-preview";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus, loadAdministrationPeriodStatus } from "@/features/administration/reports/status";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

type Search = { period?: string; half?: string };
function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit" }).format(new Date());
}

export default async function ReportesAdministracionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["reports.export", "books.read", "imports.validate"]);
  const canExport = hasAdministrationPermission(access, "reports.export");
  const canReadBooks = hasAdministrationPermission(access, "books.read");
  const canValidateImports = hasAdministrationPermission(access, "imports.validate");
  const params = await searchParams;
  const period = params.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period) ? params.period : currentPeriod();
  const half: 1 | 2 = params.half === "1" || params.half === "2" ? Number(params.half) as 1 | 2 : 1;
  const [periodStatus, draftStatus] = await Promise.all([
    canExport || canReadBooks ? loadAdministrationPeriodStatus(access, period, half) : Promise.resolve(null),
    canExport ? loadAdministrationDraftStatus(access) : Promise.resolve(null),
  ]);
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">REPORTES</span><h1>Reportes</h1><p>Libros, declaraciones, conciliación e importación histórica en un solo espacio.</p></div>
    <form action="/administracion/reportes" method="get" className="administration-period-filter administration-report-filter">
      <label htmlFor="reports-period">Período</label><input id="reports-period" type="month" name="period" defaultValue={period} />
      <label htmlFor="reports-half">Quincena</label><select id="reports-half" name="half" defaultValue={half}><option value="1">Primera quincena</option><option value="2">Segunda quincena</option></select>
      <button className="quiet-button" type="submit">Actualizar</button>
    </form>

    {canExport && <section id="declaraciones" className="work-card">
      <div className="administration-panel-heading"><div><h2>Declaraciones y exportaciones</h2><p>Salidas calculadas desde documentos emitidos y sus snapshots fiscales.</p></div></div>
      <div className="administration-export-grid">
        <form action="/api/administracion/exportaciones/libro-xlsx" method="get" className="work-form">
          <h3>Libro de compras XLSX</h3><p>Incluye las bases e IVA al 16 % y 8 % en columnas separadas y distribución contable.</p>
          <label className="field">Período<input type="month" name="period" required defaultValue={period} /></label>
          <label className="field">Quincena<select name="half" defaultValue={half}><option value="1">1–15</option><option value="2">16–fin de mes</option></select></label>
          <button className="primary-button" type="submit">Generar libro XLSX</button>
        </form>
        <form action="/api/administracion/exportaciones/iva-txt" method="get" className="work-form">
          <h3>Retenciones de IVA</h3><p>Archivo TXT quincenal con las operaciones declarables.</p>
          <label className="field">Período<input type="month" name="period" required defaultValue={period} /></label>
          <label className="field">Quincena<select name="half" required defaultValue={half}><option value="1">1–15</option><option value="2">16–fin de mes</option></select></label>
          <button className="primary-button" type="submit">Generar TXT IVA</button>
        </form>
        <form action="/api/administracion/exportaciones/islr-xml" method="get" className="work-form">
          <h3>Retenciones de ISLR</h3><p>Archivo XML mensual para revisión y carga posterior en el portal.</p>
          <label className="field">Período<input type="month" name="period" required defaultValue={period} /></label>
          <button className="primary-button" type="submit">Generar XML ISLR</button>
        </form>
        <form action="/api/administracion/exportaciones/islr-macro-xlsx" method="get" className="work-form">
          <h3>Relación ISLR para macro</h3><p>XLSX mensual con las columnas A:H de la macro histórica; el archivo no incluye macros VBA.</p>
          <label className="field">Período<input type="month" name="period" required defaultValue={period} /></label>
          <button className="primary-button" type="submit">Generar XLSX ISLR</button>
        </form>
        <section className="work-form">
          <h3>Cierre contable XLSX</h3><p>Documentos emitidos por fecha de pago o abono, con detalle de distribución por CECO.</p>
          <form action="/api/administracion/exportaciones/cierre-xlsx" method="get" className="work-form administration-close-form">
            <label className="field">Desde<input type="date" name="from" required defaultValue={`${period}-01`} /></label>
          <label className="field">Hasta<input type="date" name="to" required defaultValue={`${period}-${new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate().toString().padStart(2, "0")}`} /></label>
            <button className="primary-button" type="submit">Generar cierre XLSX</button>
          </form>
        </section>
      </div>
      <p>Las exportaciones se detienen si encuentran casos no representables en el formato entregado, como IVA mixto en una misma línea, borradores o notas que cruzan períodos.</p>
    </section>}

    {(canExport || canReadBooks) && <section id="books" className="work-card">
      <div className="administration-panel-heading"><div><h2>Libros y conciliación</h2><p>Control operativo de {period} · quincena {half}.</p></div></div>
      {periodStatus?.error ? <p className="error-message">No se pudo cargar la conciliación del período.</p> : <dl className="detail-grid">
        <div><dt>Documentos registrados</dt><dd>{periodStatus?.total ?? 0}</dd></div><div><dt>Documentos emitidos</dt><dd>{periodStatus?.issued ?? 0}</dd></div>
        <div><dt>IVA retenido</dt><dd>Bs. {((periodStatus?.ivaRetainedCents ?? 0) / 100).toFixed(2)}</dd></div><div><dt>ISLR retenido</dt><dd>Bs. {((periodStatus?.islrRetainedCents ?? 0) / 100).toFixed(2)}</dd></div>
      </dl>}
      {draftStatus && !draftStatus.error && <p className="administration-lock-note">{draftStatus.total ? `${draftStatus.total} borradores administrativos requieren revisión antes de preparar salidas.` : "No hay borradores pendientes de revisión."}</p>}
      {periodStatus && !periodStatus.error && <ul className="administration-checklist">
        <li>{periodStatus.mixedRateDocuments ? `${periodStatus.mixedRateDocuments} documentos mezclan IVA al 16 % y 8 %; revisa antes de generar TXT.` : "No se detectaron documentos con tasas mixtas en la quincena."}</li>
        <li>{periodStatus.issued ? `${periodStatus.issued} documentos emitidos alimentan la conciliación.` : "No hay documentos emitidos en esta quincena."}</li>
      </ul>}
    </section>}

    {canExport && <section className="work-card"><h2>Estado de documentos por revisar</h2>{draftStatus?.error ? <p className="error-message">No se pudo cargar el estado de borradores administrativos.</p> : <dl className="detail-grid">
      <div><dt>Borradores</dt><dd>{draftStatus?.total ?? 0}</dd></div><div><dt>Facturas</dt><dd>{draftStatus?.invoices ?? 0}</dd></div><div><dt>Notas de crédito</dt><dd>{draftStatus?.creditNotes ?? 0}</dd></div><div><dt>Notas de débito</dt><dd>{draftStatus?.debitNotes ?? 0}</dd></div>
    </dl>}</section>}

    {canValidateImports && <section id="imports" className="work-card">
      <div className="administration-panel-heading"><div><h2>Importación histórica</h2><p>Previsualiza y valida documentos anteriores antes de confirmar su carga.</p></div></div>
      <p className="administration-lock-note"><strong>Importación transaccional:</strong> el servidor vuelve a validar proveedores, configuración fiscal, cálculos, duplicados, comprobantes y facturas relacionadas al confirmar. Si una fila falla, revierte el lote completo. {access.role === "admin" ? "La confirmación está disponible para administradores." : "Este acceso permite validar; la confirmación está reservada a administradores."}</p>
      <ImportPreview canImport={access.role === "admin"} />
    </section>}
    {canExport && <p className="administration-lock-note">Las reglas y formatos fuente fueron aprobados por Contabilidad. Los archivos son salidas de revisión; la aplicación no confirma su aceptación por SENIAT.</p>}
  </div>;
}
