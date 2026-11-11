import { fail, money, validateDate, type TaxSettings } from "./core";
import type { JoinedDocument } from "./exports";
import { zipStore } from "./xlsx";

type Cell = string | number | null;
type Ceco = { code: string; name: string; percentage: number };
type Account = { code: string; name: string };

export function parseCloseRange(request: Request) {
  const query = new URL(request.url).searchParams;
  const from = validateDate(query.get("from"), "Fecha desde");
  const to = validateDate(query.get("to"), "Fecha hasta");
  if (from > to) fail("La fecha desde debe ser anterior o igual a la fecha hasta");
  return { from, to };
}

export function monthlyCloseRows(rows: JoinedDocument[], from: string, to: string) {
  return rows.filter(({ document }) => document.status === "issued" && document.eventAt >= from && document.eventAt <= to)
    .sort((a, b) => a.document.eventAt.localeCompare(b.document.eventAt) || a.document.id - b.document.id);
}

function accounting(document: JoinedDocument["document"], settings: TaxSettings) {
  let snapshot: { cecos?: Ceco[]; paymentAccount?: Account | null } = {};
  try { snapshot = JSON.parse(document.accountingSnapshot || "{}"); } catch { /* Older document: use current catalog. */ }
  let cecos = Array.isArray(snapshot.cecos) ? snapshot.cecos : [];
  if (!cecos.length) {
    let allocations: { cecoId: number; percentage: number }[] = [];
    try { allocations = JSON.parse(document.cecoAllocations || "[]"); } catch { /* Older document without allocation. */ }
    cecos = allocations.map(({ cecoId, percentage }) => {
      const item = settings.cecos.find(ceco => ceco.id === cecoId);
      return { code: item?.code ?? "", name: item?.name ?? "CECO no encontrado", percentage };
    });
  }
  const account = snapshot.paymentAccount ?? settings.paymentAccounts.find(item => item.id === document.paymentAccountId);
  return { cecos, account };
}

function xml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function col(index: number) {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
function cell(value: Cell, column: number, row: number, style: number) {
  const ref = col(column) + row;
  if (value === null || value === "") return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === "number") return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}
function sheet(headers: string[], rows: Cell[][], totals: Cell[][], widths: number[], moneyColumns: number[], company: string, range: string, title: string) {
  const last = col(headers.length - 1);
  const lines: { cells: Cell[]; kind: "title" | "header" | "data" | "total" }[] = [
    { cells: [company], kind: "title" }, { cells: [title], kind: "title" }, { cells: [range], kind: "title" },
    { cells: [], kind: "data" }, { cells: headers, kind: "header" },
    ...rows.map(cells => ({ cells, kind: "data" as const })), ...totals.map(cells => ({ cells, kind: "total" as const })),
  ];
  const rowXml = lines.map((line, index) => `<row r="${index + 1}"${index === 4 ? ' ht="34" customHeight="1"' : ""}>${line.cells.map((value, column) => {
    const style = line.kind === "title" ? 3 : line.kind === "header" ? 1 : line.kind === "total" ? moneyColumns.includes(column) ? 5 : 4 : moneyColumns.includes(column) ? 2 : 0;
    return cell(value, column, index + 1, style);
  }).join("")}</row>`).join("");
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const end = Math.max(5, 5 + rows.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rowXml}</sheetData><mergeCells count="3"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/><mergeCell ref="A3:${last}3"/></mergeCells><autoFilter ref="A5:${last}${end}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1"/></worksheet>`;
}
const typeLabel = (type: string) => type === "factura" ? "Factura" : type === "nota_credito" ? "Nota de crédito" : "Nota de débito";
const dateES = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
const amount = (cents: number) => money(cents);
const allocated = (cents: number, percentage: number, last: boolean, used: number) => last ? cents - used : Math.round(cents * percentage / 100);

export function makeMonthlyCloseXlsx(rows: JoinedDocument[], from: string, to: string, settings: TaxSettings): Uint8Array {
  const documentHeaders = ["Fecha emisión", "Pago o abono", "Tipo", "N° documento", "N° control", "RIF proveedor", "Proveedor", "Descripción", "Cuenta código", "Cuenta de pago", "CECO y reparto", "Exento (Bs.)", "Base 16 % (Bs.)", "IVA 16 % (Bs.)", "Base 8 % (Bs.)", "IVA 8 % (Bs.)", "Subtotal (Bs.)", "IVA total (Bs.)", "IVA retenido (Bs.)", "ISLR retenido (Bs.)", "Total (Bs.)", "Neto a pagar (Bs.)", "Estado", "Comprobante IVA", "Comprobante ISLR", "Base IGTF (Bs.)", "IGTF 3 % (Bs.)"];
  const distributionHeaders = ["Pago o abono", "N° documento", "RIF proveedor", "Proveedor", "Tipo", "Descripción", "Cuenta código", "Cuenta de pago", "CECO código", "Centro de costo", "Reparto (%)", "Subtotal asignado (Bs.)", "IVA asignado (Bs.)", "Total asignado (Bs.)", "Neto asignado (Bs.)", "Base IGTF asignada (Bs.)", "IGTF asignado (Bs.)"];
  const documentRows: Cell[][] = [], distributionRows: Cell[][] = [];
  const documentTotals = Array(documentHeaders.length).fill(null) as Cell[];
  const distributionTotals = Array(distributionHeaders.length).fill(null) as Cell[];
  const allocatedTotals = [0, 0, 0, 0, 0, 0];
  for (const { document: d, vendor: v } of rows) {
    const { cecos, account } = accounting(d, settings);
    const iva = d.iva16Cents + d.iva8Cents;
    documentRows.push([
      dateES(d.issuedAt), dateES(d.eventAt), typeLabel(d.type), d.number, d.controlNumber, v.rif, v.name, d.description,
      account?.code ?? "", account?.name ?? "PENDIENTE DE CUENTA", cecos.map(item => `${item.code} ${item.name} ${item.percentage}%`).join("; ") || "PENDIENTE DE DISTRIBUCIÓN",
      amount(d.exemptCents), amount(d.base16Cents), amount(d.iva16Cents), amount(d.base8Cents), amount(d.iva8Cents),
      amount(d.subtotalCents), amount(iva), amount(d.ivaRetentionCents), amount(d.islrRetentionCents), amount(d.totalCents), amount(d.netPayableCents),
      "Emitido", d.ivaCertificateNumber, d.islrCertificateNumber, amount(d.igtfBaseCents), amount(d.igtfAmountCents),
    ]);
    const distributions = cecos.length ? cecos : [{ code: "", name: "PENDIENTE DE DISTRIBUCIÓN", percentage: 0 }];
    const completeDistribution = Math.abs(cecos.reduce((sum, ceco) => sum + ceco.percentage, 0) - 100) < 0.001;
    const used = [0, 0, 0, 0, 0, 0];
    distributions.forEach((ceco, index) => {
      const isLast = completeDistribution && index === distributions.length - 1;
      const parts = cecos.length ? [d.subtotalCents, iva, d.totalCents, d.netPayableCents, d.igtfBaseCents, d.igtfAmountCents].map((value, i) => {
        const result = allocated(value, ceco.percentage, isLast, used[i]); used[i] += result; allocatedTotals[i] += result; return amount(result);
      }) : [0, 0, 0, 0];
      distributionRows.push([dateES(d.eventAt), d.number, v.rif, v.name, typeLabel(d.type), d.description,
        account?.code ?? "", account?.name ?? "PENDIENTE DE CUENTA", ceco.code, ceco.name, ceco.percentage, ...parts]);
    });
  }
  documentTotals[0] = "TOTAL";
  const documentCents = (field: keyof JoinedDocument["document"]) => rows.reduce((sum, row) => sum + Number(row.document[field] ?? 0), 0);
  for (const [index, key] of [[11, "exemptCents"], [12, "base16Cents"], [13, "iva16Cents"], [14, "base8Cents"], [15, "iva8Cents"], [16, "subtotalCents"], [18, "ivaRetentionCents"], [19, "islrRetentionCents"], [20, "totalCents"], [21, "netPayableCents"], [25, "igtfBaseCents"], [26, "igtfAmountCents"]] as const) documentTotals[index] = amount(documentCents(key));
  documentTotals[17] = amount(documentCents("iva16Cents") + documentCents("iva8Cents"));
  distributionTotals[0] = "TOTAL DISTRIBUIDO";
  for (let index = 0; index < allocatedTotals.length; index++) distributionTotals[11 + index] = amount(allocatedTotals[index]);
  const expected = [16, 17, 20, 21, 25, 26].map(index => Number(documentTotals[index] ?? 0));
  const difference = Array(distributionHeaders.length).fill(null) as Cell[];
  difference[0] = "DIFERENCIA POR REVISAR";
  for (let index = 0; index < allocatedTotals.length; index++) difference[11 + index] = Math.round((expected[index] - amount(allocatedTotals[index])) * 100) / 100;
  const company = `${settings.companyName} · RIF ${settings.companyRif}`;
  const range = `Fecha de pago o abono: del ${dateES(from)} al ${dateES(to)} · ${rows.length} documento(s) emitido(s)`;
  const files: Record<string, string> = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Documentos" sheetId="1" r:id="rId1"/><sheet name="Distribución CECO" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml": '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D5945"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"/></cellXfs></styleSheet>',
    "xl/worksheets/sheet1.xml": sheet(documentHeaders, documentRows, [documentTotals], [17, 17, 20, 20, 19, 18, 38, 62, 18, 30, 52, ...Array(11).fill(21), 14, 24, 24, 21, 21], [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 26], company, range, "CIERRE CONTABLE · DOCUMENTOS"),
    "xl/worksheets/sheet2.xml": sheet(distributionHeaders, distributionRows, [distributionTotals, difference], [17, 20, 18, 38, 20, 62, 18, 30, 18, 32, 15, 25, 25, 25, 25, 25, 25], [11, 12, 13, 14, 15, 16], company, range, "CIERRE CONTABLE · DISTRIBUCIÓN POR CECO"),
  };
  return zipStore(files);
}
