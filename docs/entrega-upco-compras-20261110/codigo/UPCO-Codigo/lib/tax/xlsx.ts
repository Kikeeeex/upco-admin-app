import { readFileSync } from "node:fs";
import path from "node:path";
import { money, type TaxSettings } from "./core";
import type { documents, vendors } from "@/db/schema";

type BookRow = { document: typeof documents.$inferSelect; vendor: typeof vendors.$inferSelect };
type Cell = string | number | null;
type Header = [string, string, string];
type SheetRow = { cells: Cell[]; kind: "title" | "section" | "header" | "data" | "total" | "summary" | "legend" | "summaryHeader" };
const enc = new TextEncoder();
const xmlEscape = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function colName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
function templateCellXml(row: number, col: number, value: Cell, style: number): string {
  const ref = colName(col) + row;
  if (value === null || value === "") return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === "number") return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}
function dateES(date: string) { return date.slice(8, 10) + "/" + date.slice(5, 7) + "/" + date.slice(0, 4); }
function periodTitle(period: string, half?: number) {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const from = half === 2 ? 16 : 1;
  const to = half === 1 ? 15 : last;
  const monthName = new Intl.DateTimeFormat("es-VE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return "Del " + String(from).padStart(2, "0") + " al " + String(to).padStart(2, "0") + " de " + monthName + " del " + year;
}
function headers(monthly: boolean): Header[] {
  const start: Header[] = [
    ["", "Número", "Operación"], ["", "Fecha", "Documento"],
    ["", "", "N°R.I.F."], ["", "", "Nombre o Razón Social"],
    ["", "Tipo de", "Proveedor"], ["Número de", "Comprobante", "Retención"],
    ["Fecha", "Aplicación", "Retención"],
  ];
  const imports: Header[] = monthly ? [
    ["N° Planilla", "Importación", "C-80/C-81"], ["Número", "Expediente", "Importación"],
    ["Número", "Declaración", "Aduana"], ["Fecha de", "Declaración", "Aduana"],
  ] : [];
  const middle: Header[] = [
    ["Número", "de", "Documento"], ["Número", "de", "Control"],
    ["Número", "Nota de", "Débito"], ["Número", "Nota de", "Crédito"],
    ["Tipo", "de", "Transacción"], ["Número", "Documento", "Afectado"],
    ["Total", "Compras", "Con IVA"],
  ];
  const tax: Header[] = monthly ? [
    ["Compras", "", "Exentas"],
  ] : [
    ["Compras", "Sin derecho a", "Crédito"],
    ["Compras", "", "Exentas"], ["Compras", "", "Exoneradas"],
    ["Compras", "", "No sujetas"],
  ];
  const end: Header[] = [
    ["Base", "16 %", "Imponible"], ["%", "16 %", "Alícuota"], ["Impuesto", "16 %", "IVA"],
    ["Base", "8 %", "Imponible"], ["%", "8 %", "Alícuota"], ["Impuesto", "8 %", "IVA"],
    ["IVA Retenido", "(al", "Vendedor)"],
  ];
  return [...start, ...imports, ...middle, ...tax, ...end];
}
function makeDataRow(row: BookRow, number: number, monthly: boolean, affected: Map<number, string>): Cell[] {
  const d = row.document, v = row.vendor;
  const base: Cell[] = [
    number, dateES(d.issuedAt), v.rif, v.name, v.taxpayerType,
    d.ivaCertificateNumber || "", d.ivaCertificateNumber ? dateES(d.eventAt) : "",
  ];
  const imports: Cell[] = monthly ? ["", "", "", ""] : [];
  const middle: Cell[] = [
    d.type === "factura" ? d.number : "", d.controlNumber,
    d.type === "nota_debito" ? d.number : "",
    d.type === "nota_credito" ? d.number : "",
    d.type === "factura" ? "01 Registro" : d.type === "nota_debito" ? "02 Nota de débito" : "03 Nota de crédito",
    d.affectedDocumentId ? (affected.get(d.affectedDocumentId) ?? "") : "",
    money(d.totalCents),
  ];
  const tax: Cell[] = monthly
    ? [money(d.exemptCents)]
    : [0, money(d.exemptCents), 0, 0];
  const end: Cell[] = [
    money(d.base16Cents), d.base16Cents ? 16 : 0, money(d.iva16Cents),
    money(d.base8Cents), d.base8Cents ? 8 : 0, money(d.iva8Cents),
    money(d.ivaRetentionCents),
  ];
  return [...base, ...imports, ...middle, ...tax, ...end];
}
type AccountingCeco = { id: number; code: string; name: string; percentage: number };
type AccountingAccount = { id: number; code: string; name: string };
type AccountingSnapshot = { cecos?: AccountingCeco[]; paymentAccount?: AccountingAccount | null };

function accountingDetails(document: BookRow["document"], settings: TaxSettings) {
  let snapshot: AccountingSnapshot = {};
  try { snapshot = JSON.parse(document.accountingSnapshot || "{}") as AccountingSnapshot; } catch { /* Fall back to current catalog. */ }
  let cecos = Array.isArray(snapshot.cecos) ? snapshot.cecos : [];
  if (!cecos.length) {
    let allocations: { cecoId: number; percentage: number }[] = [];
    try { allocations = JSON.parse(document.cecoAllocations || "[]") as typeof allocations; } catch { /* Missing legacy distribution. */ }
    cecos = allocations.map(allocation => {
      const item = settings.cecos.find(ceco => ceco.id === allocation.cecoId);
      return { id: allocation.cecoId, code: item?.code ?? "", name: item?.name ?? "CECO no encontrado", percentage: allocation.percentage };
    });
  }
  const account = snapshot.paymentAccount ?? settings.paymentAccounts.find(item => item.id === document.paymentAccountId);
  return { cecos, account };
}

function makeAccountingSheet(rows: BookRow[], period: string, half: number | undefined, settings: TaxSettings): string {
  const headers = ["Fecha emisión", "RIF proveedor", "Proveedor", "Tipo", "N° documento", "Descripción", "Cuenta código", "Cuenta de pago", "CECO código", "Centro de costo", "Reparto (%)", "Subtotal asignado (Bs.)", "Total asignado (Bs.)"];
  const grid: SheetRow[] = [
    { cells: ["", "", settings.companyName + " - RIF " + settings.companyRif], kind: "title" },
    { cells: ["", "", "DISTRIBUCIÓN CONTABLE DE COMPRAS"], kind: "title" },
    { cells: ["", "", periodTitle(period, half)], kind: "title" },
    { cells: [], kind: "data" },
    { cells: headers, kind: "header" },
  ];
  let allocatedSubtotal = 0, allocatedTotal = 0;
  for (const { document: d, vendor: v } of rows) {
    const { cecos, account } = accountingDetails(d, settings);
    const distributions = cecos.length ? cecos : [{ id: 0, code: "", name: "PENDIENTE DE DISTRIBUCIÓN", percentage: 0 }];
    let usedSubtotal = 0, usedTotal = 0;
    distributions.forEach((ceco, index) => {
      const valid = cecos.length > 0;
      const subtotal = !valid ? 0 : index === distributions.length - 1
        ? d.subtotalCents - usedSubtotal : Math.round(d.subtotalCents * ceco.percentage / 100);
      const total = !valid ? 0 : index === distributions.length - 1
        ? d.totalCents - usedTotal : Math.round(d.totalCents * ceco.percentage / 100);
      usedSubtotal += subtotal;
      usedTotal += total;
      allocatedSubtotal += subtotal;
      allocatedTotal += total;
      grid.push({ cells: [
        dateES(d.issuedAt), v.rif, v.name,
        d.type === "factura" ? "Factura" : d.type === "nota_credito" ? "Nota de crédito" : "Nota de débito",
        d.number, d.description, account?.code ?? "", account?.name ?? "PENDIENTE DE CUENTA",
        ceco.code, ceco.name, ceco.percentage, money(subtotal), money(total),
      ], kind: "data" });
    });
  }
  const expectedSubtotal = rows.reduce((sum, row) => sum + row.document.subtotalCents, 0);
  const expectedTotal = rows.reduce((sum, row) => sum + row.document.totalCents, 0);
  const totalLine = (label: string, subtotal: number, total: number): SheetRow => {
    const cells: Cell[] = Array(headers.length).fill(null);
    cells[0] = label;
    cells[11] = money(subtotal);
    cells[12] = money(total);
    return { cells, kind: "total" };
  };
  grid.push(totalLine("TOTAL DISTRIBUIDO", allocatedSubtotal, allocatedTotal));
  grid.push(totalLine("TOTAL DEL LIBRO", expectedSubtotal, expectedTotal));
  grid.push(totalLine("DIFERENCIA POR REVISAR", expectedSubtotal - allocatedSubtotal, expectedTotal - allocatedTotal));
  const rowXml = grid.map((line, index) => {
    const cells = line.cells.map((value, column) => {
      const style = typeof value === "number" ? 20 : line.kind === "header" ? 4 : line.kind === "title" ? 2 : line.kind === "total" ? 31 : 0;
      return templateCellXml(index + 1, column, value, style);
    }).join("");
    return `<row r="${index + 1}"${index === 4 ? ' ht="34" customHeight="1"' : ""}>${cells}</row>`;
  }).join("");
  const widths = [17, 17, 38, 18, 20, 55, 18, 34, 18, 32, 17, 24, 24];
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const dataEnd = Math.max(5, 5 + rows.reduce((n, row) => n + Math.max(1, accountingDetails(row.document, settings).cecos.length), 0));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + cols + '</cols><sheetData>' + rowXml + '</sheetData><mergeCells count="3"><mergeCell ref="C1:M1"/><mergeCell ref="C2:M2"/><mergeCell ref="C3:M3"/></mergeCells><autoFilter ref="A5:M' + dataEnd + '"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1"/></worksheet>';
}
export function makeBookXlsx(rows: BookRow[], period: string, half: number | undefined, settings: TaxSettings, allRows: BookRow[] = rows): Uint8Array {
  // The supplied 0201C sheet is the first-half model; 0202C is the second-half/monthly model.
  const monthly = half !== 1;
  const columns = headers(monthly), width = columns.length;
  const endCol = colName(width - 1);
  const base16 = width - 7, iva16 = width - 5, base8 = width - 4, iva8 = width - 2, retained = width - 1;
  const totalColumn = monthly ? 17 : 13;
  const exemptColumn = monthly ? 18 : 15;
  const summaryBase = monthly ? 7 : 5;
  const summaryTax = summaryBase + 1;
  const affected = new Map(allRows.map(x => [x.document.id, x.document.number]));
  const grid: SheetRow[] = [
    { cells: ["", "", "", settings.companyName + " - RIF " + settings.companyRif], kind: "title" },
    { cells: ["", "", "", "Libro de Compras"], kind: "title" },
    { cells: ["", "", "", periodTitle(period, half)], kind: "title" },
    { cells: [], kind: "data" },
    { cells: Array(width).fill(null), kind: "section" },
  ];
  grid[4].cells[monthly ? 17 : 16] = "INTERNAS";
  for (let level = 0; level < 3; level++) grid.push({ cells: columns.map(h => h[level]), kind: "header" });
  rows.forEach((row, index) => grid.push({ cells: makeDataRow(row, index + 1, monthly, affected), kind: "data" }));
  const sum = (key: keyof typeof documents.$inferSelect) => rows.reduce((n, x) => n + Number(x.document[key] ?? 0), 0);
  const totalRow: Cell[] = Array(width).fill(null);
  totalRow[0] = "Totales:";
  totalRow[totalColumn] = money(sum("totalCents"));
  totalRow[exemptColumn] = money(sum("exemptCents"));
  totalRow[base16] = money(sum("base16Cents"));
  totalRow[iva16] = money(sum("iva16Cents"));
  totalRow[base8] = money(sum("base8Cents"));
  totalRow[iva8] = money(sum("iva8Cents"));
  totalRow[retained] = money(sum("ivaRetentionCents"));
  grid.push({ cells: totalRow, kind: "total" });
  grid.push({ cells: ["Separacion de seccion de Ajuste"], kind: "section" });
  grid.push({ cells: ["Créditos Fiscales en Bolívar"], kind: "section" });
  grid.push({ cells: ["DE = Deducibles          PD = Parcialmente Deducibles          ND = No Deducibles"], kind: "legend" });
  const summaryHeaders: Cell[] = Array(width).fill(null);
  summaryHeaders[summaryBase] = "Base Imponible";
  summaryHeaders[summaryTax] = "Crédito Fiscal";
  grid.push({ cells: summaryHeaders, kind: "summaryHeader" });
  const summary = (label: string, base?: number, tax?: number) => {
    const cells: Cell[] = Array(width).fill(null);
    cells[0] = label;
    if (base !== undefined) cells[summaryBase] = money(base);
    if (tax !== undefined) cells[summaryTax] = money(tax);
    grid.push({ cells, kind: "summary" });
  };
  summary("Total de las Compras de Importación afectadas sólo en alícuota General", 0, 0);
  summary("Total de las Compras de Importación afectadas en alícuota General + Adicional", 0, 0);
  summary("Total de las Compras de Importación afectadas en alícuota Reducida", 0, 0);
  summary("Total de las Compras de Importación Exentas/Exoneradas", 0);
  summary("Total de las Compras Internas afectadas sólo en alícuota General", sum("base16Cents"), sum("iva16Cents"));
  summary("Total de las Compras Internas afectadas en alícuota General + Adicional", 0, 0);
  summary("Total de las Compras Internas afectadas en alícuota Reducida", sum("base8Cents"), sum("iva8Cents"));
  summary("Total de las Compras Exentas Internas", sum("exemptCents"));
  summary("Total de las Compras Exoneradas", 0);
  summary("Total de las Compras No Sujetas", 0);
  summary("Total de las Compras Sin derecho a Crédito", 0);
  summary("Total General", undefined, sum("totalCents"));
  summary("Créditos Fiscales Totalmente Deducible", undefined, sum("iva16Cents") + sum("iva8Cents"));
  summary("Créditos Fiscales Parcialmente Deducible", undefined, 0);
  summary("Total Créditos Fiscales Deducibles", undefined, sum("iva16Cents") + sum("iva8Cents"));
  grid.push({ cells: [], kind: "data" });
  summary("Total Iva Retenido al Vendedor", undefined, sum("ivaRetentionCents"));
  summary("Total Iva Retenido (Importación)", undefined, 0);
  grid.push({ cells: [], kind: "data" });
  summary("Ajuste a los créditos fiscales de períodos anteriores", undefined, 0);
  const rowXml = grid.map((line, i) => {
    const rowNumber = i + 1;
    const cells = line.cells.map((value, j) => {
      if (rowNumber === 5) {
        const begin = monthly ? 17 : 13;
        const finish = iva8;
        if (j >= begin && j <= finish) {
          const style = monthly
            ? j === begin ? 67 : j === finish ? 68 : 66
            : j === begin ? 7 : j === finish ? 8 : value ? 6 : 5;
          return templateCellXml(rowNumber, j, value, style);
        }
      }
      if ((value === null || value === "") && !["header", "data", "total"].includes(line.kind)) return "";
      let style = 0;
      if (line.kind === "title") style = rowNumber === 3 ? 3 : 2;
      else if (line.kind === "section") style = rowNumber === 5 ? 6 : rowNumber === rows.length + 10 ? 39 : 40;
      else if (line.kind === "legend") style = 41;
      else if (line.kind === "summaryHeader") style = 4;
      else if (line.kind === "header") style = rowNumber === 8 ? 11 : 4;
      else if (line.kind === "total") style = typeof value === "number" ? 35 : 31;
      else if (line.kind === "summary") {
        const closing = String(line.cells[0] ?? "").startsWith("Total Iva Retenido") || String(line.cells[0] ?? "").startsWith("Ajuste a los créditos");
        style = typeof value === "number" ? (closing ? 43 : 34) : (closing ? 42 : 31);
      } else if (typeof value === "number") {
        style = j === 0 ? 14 : j === base16 + 1 || j === base8 + 1 ? 19 : value === 0 ? 18 : 20;
      } else style = j === 5 ? 29 : 15;
      return templateCellXml(rowNumber, j, value, style);
    }).join("");
    const height = rowNumber <= 2 ? 15 : rowNumber === 3 ? 12.95 : rowNumber >= 5 && rowNumber <= 8 ? rowNumber === 5 ? 10.9 : 12.2 : line.kind === "data" && rowNumber <= 9 + rows.length ? 12.2 : 10.9;
    return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");
  const sourceWidths = monthly
    ? [8.43, 9, 11.29, 35.29, 9.29, 13, 9.43, 13.14, 11.71, 10, 10, 10, 10, 10, 7.29, 11, 10, 10.14, 8.43, 10.14, 9.14, 8.86, 10.14, 9.14, 8.86, 11.29]
    : [8.43, 9, 11.29, 36, 9.29, 13.14, 11.71, 10, 10.14, 7.29, 7.29, 11, 10, 8.71, 11.71, 8.29, 10.14, 9.29, 8.86, 7.29, 8.57, 9.29, 7.29, 8.57, 11.14];
  const cols = sourceWidths.map((value, i) => `<col min="${i + 1}" max="${i + 1}" width="${value}" customWidth="1"/>`).join("");
  const mergeXml = monthly ? '<mergeCells count="1"><mergeCell ref="R5:Y5"/></mergeCells>' : "";
  const margins = monthly ? 'left="0" right="0" top="0" bottom="0" header="0.5" footer="0.5"' : 'left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"';
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + endCol + grid.length + '"/><sheetViews><sheetView workbookViewId="0" zoomScale="85"/></sheetViews><sheetFormatPr baseColWidth="10" defaultRowHeight="12.75"/><cols>' + cols + '</cols><sheetData>' + rowXml + '</sheetData>' + mergeXml + '<pageMargins ' + margins + '/><pageSetup paperSize="5" scale="30" fitToHeight="0" orientation="landscape"/></worksheet>';
  const styles = readFileSync(path.join(process.cwd(), "public", "upco-book-styles.xml"), "utf8");
  const theme = readFileSync(path.join(process.cwd(), "public", "upco-book-theme.xml"), "utf8");
  const files: Record<string, string> = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Compras" sheetId="1" r:id="rId1"/><sheet name="Distribución contable" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">\'Compras\'!$1:$8</definedName></definedNames></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>',
    "xl/styles.xml": styles,
    "xl/theme/theme1.xml": theme,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/worksheets/sheet2.xml": makeAccountingSheet(rows, period, half, settings),
  };
  return zipStore(files);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(v: number) { return [v & 255, (v >>> 8) & 255]; }
function u32(v: number) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
export function zipStore(files: Record<string, string>): Uint8Array {
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, count = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = enc.encode(path), data = enc.encode(content), crc = crc32(data);
    const localHeader = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    local.push(localHeader, name, data);
    const centralHeader = Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
    count++;
  }
  const centralBytes = concat(central);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(centralBytes.length), ...u32(offset), ...u16(0)]);
  return concat([...local, centralBytes, end]);
}
