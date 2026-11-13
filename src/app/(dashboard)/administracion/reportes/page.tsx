import { ImportPreview } from "@/components/administration/import-preview";
import { getAccessContext } from "@/features/auth/access";
import { loadAdministrationDraftStatus, loadAdministrationPeriodStatus } from "@/features/administration/reports/status";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";
import { BookOpen, FileArchive, FileSpreadsheet, FileText } from "lucide-react";

type Search = { period?: string; half?: string };
type Half = 1 | 2 | "all";
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
  const half: Half = params.half === "2" ? 2 : params.half === "all" ? "all" : 1;
  const [periodStatuses, draftStatus] = await Promise.all([
    canExport || canReadBooks
      ? Promise.all((half === "all" ? [1, 2] as const : [half] as const).map((selectedHalf) => loadAdministrationPeriodStatus(access, period, selectedHalf)))
      : Promise.resolve(null),
    canExport ? loadAdministrationDraftStatus(access) : Promise.resolve(null),
  ]);
  const periodStatus = periodStatuses ? {
    total: periodStatuses.reduce((sum, status) => sum + status.total, 0),
    issued: periodStatuses.reduce((sum, status) => sum + status.issued, 0),
    ivaRetainedCents: periodStatuses.reduce((sum, status) => sum + status.ivaRetainedCents, 0),
    islrRetainedCents: periodStatuses.reduce((sum, status) => sum + status.islrRetainedCents, 0),
    mixedRateDocuments: periodStatuses.reduce((sum, status) => sum + status.mixedRateDocuments, 0),
    error: periodStatuses.some((status) => status.error),
  } : null;
  const periodLabel = half === "all" ? "mes completo" : `quincena ${half}`;
  const monthEnd = new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate().toString().padStart(2, "0");
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">CIERRE FISCAL</span><h1>Reportes y exportaciones</h1><p>Descarga los archivos generados a partir de los mismos documentos.</p></div>
    <form action="/administracion/reportes" method="get" className="administration-period-filter administration-report-filter">
      <label htmlFor="reports-period">Período</label><input id="reports-period" type="month" name="period" defaultValue={period} />
      <select id="reports-half" name="half" aria-label="Quincena de exportación" defaultValue={half}><option value="all">Mes completo</option><option value="1">Primera quincena</option><option value="2">Segunda quincena</option></select>
      <span className="administration-report-period">Período: {period}{half === "all" ? "" : ` · ${half === 1 ? "1–15" : "16–fin de mes"}`}</span>
      <button className="quiet-button" type="submit">Actualizar</button>
    </form>

    {canExport && <>
      <div id="declaraciones" className="administration-report-grid">
        <form action="/api/administracion/exportaciones/libro-xlsx" method="get" className="administration-report-card">
          <div className="administration-report-icon green"><BookOpen size={21} aria-hidden="true" /></div><h2>Libro de compras</h2>
          <p>Excel con columnas separadas para base e IVA al 16 % y al 8 %, además de totales, retenciones y distribución contable.</p>
          <input type="hidden" name="period" value={period} />{half !== "all" && <input type="hidden" name="half" value={half} />}
          <button className="quiet-button" type="submit">Descargar Excel</button>
        </form>
        <form action="/api/administracion/exportaciones/iva-txt" method="get" className="administration-report-card">
          <div className="administration-report-icon blue"><FileText size={21} aria-hidden="true" /></div><h2>Retenciones de IVA</h2>
          <p>TXT de la quincena para revisión y carga posterior en SENIAT. Requiere seleccionar primera o segunda quincena.</p>
          <input type="hidden" name="period" value={period} />{half !== "all" && <input type="hidden" name="half" value={half} />}
          <button className="quiet-button" type="submit" disabled={half === "all"}>{half === "all" ? "Selecciona una quincena" : "Descargar TXT"}</button>
        </form>
        <form action="/api/administracion/exportaciones/islr-xml" method="get" className="administration-report-card">
          <div className="administration-report-icon sand"><FileArchive size={21} aria-hidden="true" /></div><h2>Retenciones de ISLR</h2>
          <p>Archivo XML mensual con los conceptos y datos de las retenciones practicadas.</p><input type="hidden" name="period" value={period} />
          <button className="quiet-button" type="submit">Descargar XML</button>
        </form>
        <form action="/api/administracion/exportaciones/islr-macro-xlsx" method="get" className="administration-report-card">
          <div className="administration-report-icon green"><FileSpreadsheet size={21} aria-hidden="true" /></div><h2>Relación ISLR para macro</h2>
          <p>Excel mensual con las columnas A:H de la macro histórica. Copia esos datos en la macro original; el archivo no contiene macros.</p><input type="hidden" name="period" value={period} />
          <button className="quiet-button" type="submit">Descargar Excel</button>
        </form>
      </div>
      <section className="work-card administration-report-close">
        <div className="administration-panel-heading"><div><h2>Cierre contable por fechas</h2><p>Excel con descripción de cada compra, cuenta de pago y distribución entre CECO para revisar la contabilidad.</p></div><FileSpreadsheet size={19} color="#5f9c70" aria-hidden="true" /></div>
        <form action="/api/administracion/exportaciones/cierre-xlsx" method="get" className="administration-close-form">
          <label className="field">Desde<input type="date" name="from" required defaultValue={`${period}-01`} /></label>
          <label className="field">Hasta<input type="date" name="to" required defaultValue={`${period}-${monthEnd}`} /></label>
          <button className="primary-button" type="submit">Exportar cierre</button>
        </form>
        <p>Incluye documentos emitidos con pago o abono en cuenta dentro del rango, sin borradores ni anulados.</p>
      </section>
      <p className="administration-lock-note">Las exportaciones se detienen si encuentran casos no representables en el formato entregado, como documentos mixtos, borradores o notas que cruzan períodos.</p>
    </>}

    {(canExport || canReadBooks) && <section id="books" className="work-card">
      <div className="administration-panel-heading"><div><h2>Libros y conciliación</h2><p>Control operativo de {period} · {periodLabel}.</p></div></div>
      {periodStatus?.error ? <p className="error-message">No se pudo cargar la conciliación del período.</p> : <dl className="detail-grid">
        <div><dt>Documentos registrados</dt><dd>{periodStatus?.total ?? 0}</dd></div><div><dt>Documentos emitidos</dt><dd>{periodStatus?.issued ?? 0}</dd></div>
        <div><dt>IVA retenido</dt><dd>Bs. {((periodStatus?.ivaRetainedCents ?? 0) / 100).toFixed(2)}</dd></div><div><dt>ISLR retenido</dt><dd>Bs. {((periodStatus?.islrRetainedCents ?? 0) / 100).toFixed(2)}</dd></div>
      </dl>}
      {draftStatus && !draftStatus.error && <p className="administration-lock-note">{draftStatus.total ? `${draftStatus.total} borradores administrativos requieren revisión antes de preparar salidas.` : "No hay borradores pendientes de revisión."}</p>}
      {periodStatus && !periodStatus.error && <ul className="administration-checklist">
        <li>{periodStatus.mixedRateDocuments ? `${periodStatus.mixedRateDocuments} documentos mezclan IVA al 16 % y 8 %; revisa antes de generar TXT.` : `No se detectaron documentos con tasas mixtas en el período seleccionado (${periodLabel}).`}</li>
        <li>{periodStatus.issued ? `${periodStatus.issued} documentos emitidos alimentan la conciliación.` : `No hay documentos emitidos en ${periodLabel}.`}</li>
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
