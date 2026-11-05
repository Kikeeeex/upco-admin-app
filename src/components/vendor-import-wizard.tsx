"use client";

import { useState } from "react";
import { commitVendorImport, inspectVendorImport, previewVendorImport } from "@/features/procurement/vendor-import-actions";
import { vendorImportFields, type VendorImportField, type VendorImportMapping } from "@/features/procurement/vendor-import-fields";

type Inspection = Extract<Awaited<ReturnType<typeof inspectVendorImport>>, { kind: "success" }>;
type Preview = Extract<Awaited<ReturnType<typeof previewVendorImport>>, { kind: "success" }>;
type Result = Extract<Awaited<ReturnType<typeof commitVendorImport>>, { kind: "success" }>;
const statusLabels: Record<Preview["rows"][number]["status"], string> = {
  new: "Nuevo", match: "Existente", review: "Revisar", duplicate_file: "Repetido en archivo", error: "Error",
};

function downloadIncidents(incidents: Result["incidents"]) {
  const csvCell = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = "\uFEFFFila,Estado,Incidencia\r\n" + incidents.map((row) =>
    [row.sourceRow, row.status, row.reason].map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "incidencias-proveedores.csv"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VendorImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [mapping, setMapping] = useState<VendorImportMapping>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState("");
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedFields, setSelectedFields] = useState<VendorImportField[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(1);
  const [incidentOnly, setIncidentOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const formData = (withMapping = false) => {
    const form = new FormData();
    if (file) form.set("file", file);
    if (sheet) form.set("sheet", sheet);
    if (withMapping) form.set("mapping", JSON.stringify(mapping));
    return form;
  };
  const run = async <T,>(task: () => Promise<T>, onSuccess: (value: T) => void) => {
    setBusy(true); setError("");
    try { onSuccess(await task()); }
    catch { setError("No se pudo procesar el archivo. Vuelve a intentarlo."); }
    finally { setBusy(false); }
  };
  const load = () => run(() => inspectVendorImport(formData()), (response) => {
    if (response.kind === "error") { setError(response.message); return; }
    setInspection(response); setMapping(response.mapping); setSheet(response.sheetName ?? "");
    setPreview(null); setResult(null); setConfirmed(false);
  });
  const showPreview = () => run(() => previewVendorImport(formData(true)), (response) => {
    if (response.kind === "error") { setError(response.message); return; }
    setPreview(response); setResult(null); setSelectedRows([]); setSelectedFields([]); setConfirmed(false); setPage(1); setIncidentOnly(false);
  });
  const commit = () => {
    if (!preview || !confirmed) return;
    const form = formData(true);
    form.set("digest", preview.digest);
    form.set("selectedRows", JSON.stringify(selectedRows));
    form.set("selectedFields", JSON.stringify(selectedFields));
    return run(() => commitVendorImport(form), (response) => {
      if (response.kind === "error") { setError(response.message); setConfirmed(false); return; }
      setResult(response); setPreview(null);
    });
  };
  const pageSize = 30;
  const visibleRows = preview?.rows.filter((row) => !incidentOnly || row.status !== "new" || row.warnings.length > 0) ?? [];
  const shown = visibleRows.slice((page - 1) * pageSize, page * pageSize);

  return <div className="vendor-import-wizard">
    <section className="work-card"><h2>1. Archivo</h2>
      <p>Selecciona un XLSX o CSV de hasta 4 MB y 10 000 filas. El archivo se procesa para esta importación; no se almacena.</p>
      <div className="field"><label htmlFor="vendor-import-file">Archivo XLSX o CSV</label>
        <input id="vendor-import-file" type="file" accept=".xlsx,.csv" onChange={(event) => {
          setFile(event.target.files?.[0] ?? null); setInspection(null); setPreview(null); setResult(null); setError(""); setSheet("");
        }} /></div>
      <button className="primary-button" type="button" disabled={!file || busy} onClick={load}>{busy ? "Leyendo…" : "Leer archivo"}</button>
      {inspection && <p role="status">{inspection.fileName}: {inspection.rowsRead} filas con datos; {inspection.blankRows} vacías.</p>}
      {inspection && inspection.sheets.length > 1 && <div className="field"><label htmlFor="vendor-import-sheet">Hoja</label>
        <select id="vendor-import-sheet" value={sheet} onChange={(event) => { setSheet(event.target.value); setInspection(null); setPreview(null); }}>
          {inspection.sheets.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></div>}
    </section>
    {inspection && <section className="work-card"><h2>2. Mapeo de columnas</h2>
      <p>Comprueba las diez columnas comerciales. Solo «Proveedor» es obligatorio. Las columnas sin asignar se ignoran.</p>
      <div className="work-form vendor-form">{vendorImportFields.map((field) =>
        <div className="field" key={field.key}><label htmlFor={`map-${field.key}`}>{field.label}</label>
          <select id={`map-${field.key}`} value={mapping[field.key] ?? ""} onChange={(event) => {
            const next = { ...mapping };
            if (event.target.value === "") delete next[field.key]; else next[field.key] = Number(event.target.value);
            setMapping(next); setPreview(null); setConfirmed(false);
          }}><option value="">Sin asignar</option>{inspection.headers.map((header, index) =>
            <option key={index} value={index}>Columna {index + 1} · {header.trim() || "Sin encabezado"}</option>)}</select>
        </div>)}</div>
      <button className="primary-button" type="button" disabled={busy || mapping.name === undefined} onClick={showPreview}>Generar vista previa</button>
    </section>}
    {preview && <section className="work-card work-list"><h2>3. Vista previa</h2>
      <p>{preview.counts.new} nuevos · {preview.counts.match} existentes · {preview.counts.review} para revisar · {preview.counts.duplicate_file} repetidos en el archivo · {preview.counts.error} con error.</p>
      <p>Los existentes, repetidos y casos para revisar se omiten por defecto. Las filas con error se rechazan.</p>
      <label><input type="checkbox" checked={incidentOnly} onChange={(event) => { setIncidentOnly(event.target.checked); setPage(1); }} /> Solo incidencias</label>
      {preview.counts.match > 0 && <fieldset className="vendor-import-updates"><legend>Actualizaciones opcionales</legend>
        <p>Marca las filas existentes que deseas actualizar y los campos que se pueden copiar. Las celdas vacías nunca borran datos.</p>
        <div className="vendor-import-field-grid">{vendorImportFields.map((field) => <label key={field.key}>
          <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={(event) => setSelectedFields((before) => event.target.checked ? [...before, field.key] : before.filter((key) => key !== field.key))} /> {field.label}
        </label>)}</div>
      </fieldset>}
      <div className="table-scroll"><table><thead><tr><th>Fila</th><th>Proveedor</th><th>País</th><th>Área de venta</th><th>Resultado</th><th>Incidencia</th><th>Actualizar</th></tr></thead><tbody>
        {shown.map((row) => <tr key={row.sourceRow}><td>{row.sourceRow}</td><td>{row.name}</td><td>{row.country || "—"}</td><td>{row.salesArea || "—"}</td>
          <td>{statusLabels[row.status]}</td><td>{[...row.errors, ...row.warnings, row.reason].filter(Boolean).join(" ") || "—"}</td>
          <td>{row.editable ? <input type="checkbox" aria-label={`Actualizar fila ${row.sourceRow}`} checked={selectedRows.includes(row.sourceRow)}
            onChange={(event) => setSelectedRows((before) => event.target.checked ? [...before, row.sourceRow] : before.filter((number) => number !== row.sourceRow))} /> : "—"}</td></tr>)}
      </tbody></table></div>
      {visibleRows.length > pageSize && <nav className="pagination" aria-label="Páginas de la vista previa">
        <button type="button" className="quiet-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page} de {Math.ceil(visibleRows.length / pageSize)}</span>
        <button type="button" className="quiet-button" disabled={page * pageSize >= visibleRows.length} onClick={() => setPage(page + 1)}>Siguiente</button>
      </nav>}
      <label className="vendor-import-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo la importación de las filas nuevas y las actualizaciones seleccionadas.</label>
      <button type="button" className="primary-button" disabled={!confirmed || busy} onClick={commit}>{busy ? "Importando…" : "Confirmar importación"}</button>
    </section>}
    {result && <section className="work-card"><h2>4. Resultado</h2><p role="status">{result.counts.created} creados · {result.counts.updated} actualizados · {result.counts.skipped} omitidos · {result.counts.rejected} rechazados.</p>
      <p>Lote: {result.batchId}</p>
      {result.incidents.length > 0 && <button type="button" className="quiet-button" onClick={() => downloadIncidents(result.incidents)}>Descargar incidencias CSV</button>}
    </section>}
    {error && <p role="alert" className="error-message">{error}</p>}
  </div>;
}
