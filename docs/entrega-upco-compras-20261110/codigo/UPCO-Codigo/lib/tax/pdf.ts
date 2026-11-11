import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { money, type TaxSettings } from "./core";
import type { documents, vendors } from "@/db/schema";
import { ISLR_CONCEPTS } from "./islrConcepts";

type Purchase = typeof documents.$inferSelect;
type Vendor = typeof vendors.$inferSelect;
const black = rgb(0.08, 0.08, 0.08);
const gray = rgb(0.84, 0.84, 0.84);
const white = rgb(1, 1, 1);
const fmt = (cents: number) => new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(money(cents));
const dt = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
const safe = (v: unknown) => String(v ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\u0020-\u00FF]/g, "");
function fit(v: unknown, font: PDFFont, size: number, width: number) {
  let s = safe(v).replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  while (s && font.widthOfTextAtSize(s + "...", size) > width) s = s.slice(0, -1);
  return s + "...";
}
function txt(p: PDFPage, f: PDFFont, v: unknown, x: number, y: number, size: number, max?: number) {
  p.drawText(max === undefined ? safe(v) : fit(v, f, size, max), { x, y, size, font: f, color: black });
}
function right(p: PDFPage, f: PDFFont, v: unknown, x: number, y: number, size: number, max?: number) {
  const s = max === undefined ? safe(v) : fit(v, f, size, max);
  p.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color: black });
}
function center(p: PDFPage, f: PDFFont, v: unknown, x: number, y: number, size: number, max?: number) {
  const s = max === undefined ? safe(v) : fit(v, f, size, max);
  p.drawText(s, { x: x - f.widthOfTextAtSize(s, size) / 2, y, size, font: f, color: black });
}
function rect(p: PDFPage, x: number, y: number, width: number, height: number, shaded = false) {
  p.drawRectangle({ x, y, width, height, color: shaded ? gray : white, borderColor: black, borderWidth: 0.55 });
}
function line(p: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.55, color: black });
}
function wrap(p: PDFPage, f: PDFFont, v: unknown, x: number, y: number, width: number, size: number, leading: number, maxLines: number) {
  const words = safe(v).replace(/\s+/g, " ").trim().split(" ");
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    const next = row ? row + " " + word : word;
    if (f.widthOfTextAtSize(next, size) > width && row) { rows.push(row); row = word; }
    else row = next;
  }
  if (row) rows.push(row);
  rows.slice(0, maxLines).forEach((s, i) => txt(p, f, s, x, y - i * leading, size, width));
}
async function logo(pdf: PDFDocument, p: PDFPage, x: number, y: number, width: number, height: number) {
  const data = await readFile(path.join(process.cwd(), "public", "upco-logo.png"));
  const image = await pdf.embedPng(data);
  p.drawImage(image, { x, y, width, height });
}
async function scannedImage(pdf: PDFDocument, p: PDFPage, filename: string, x: number, y: number, width: number) {
  const data = await readFile(path.join(process.cwd(), "assets", "retention", filename));
  const image = await pdf.embedPng(data);
  p.drawImage(image, { x, y, width, height: width * image.height / image.width });
}
function ivaParty(p: PDFPage, f: PDFFont, b: PDFFont, x: number, top: number, width: number, label: string, name: string, rif: string, address: string) {
  const first = width * 0.305, second = width * 0.285;
  rect(p, x, top - 31, width, 31);
  line(p, x + first, top - 31, x + first, top);
  line(p, x + first + second, top - 31, x + first + second, top);
  txt(p, b, label, x + 2, top - 8, 6.9, first - 4);
  txt(p, b, "Registro de Información Fiscal:", x + first + 2, top - 8, 6.9, second - 4);
  txt(p, b, "Dirección Fiscal:", x + first + second + 2, top - 8, 6.9, width - first - second - 4);
  line(p, x, top - 13, x + width, top - 13);
  wrap(p, f, name, x + 2, top - 20, first - 4, 6.1, 7.2, 2);
  txt(p, f, rif, x + first + 2, top - 25, 7.2, second - 4);
  wrap(p, f, address, x + first + second + 2, top - 20, width - first - second - 4, 5.8, 7.2, 2);
}
function islrParty(p: PDFPage, f: PDFFont, b: PDFFont, x: number, top: number, width: number, heading: string, name: string, rif: string, person: string, address: string, phone: string) {
  rect(p, x, top - 69, width, 69);
  rect(p, x, top - 17, width, 17, true);
  center(p, b, heading, x + width / 2, top - 12, 10.3);
  const end = x + 123;
  const rows: [string, string, number][] = [
    ["RAZÓN SOCIAL.", name, 8.1], ["RIF.", rif, 8.1], ["TIPO DE PERSONA.", person, 8],
    ["DIRECCIÓN FISCAL.", address, 7.2], ["TELÉFONO.", phone, 8],
  ];
  rows.forEach(([key, value, size], i) => {
    const y = top - 27 - i * 9.5;
    right(p, b, key, end, y, 7.2);
    txt(p, i === 0 ? b : f, value, end + 3, y, size, width - 127);
  });
}
function periodLabel(eventAt: string) {
  const d = new Date(eventAt.slice(0, 7) + "-01T12:00:00Z");
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const month = new Intl.DateTimeFormat("es-VE", { month: "long", timeZone: "UTC" }).format(d);
  return "Período del 01 al " + last + " de " + month + " de " + d.getUTCFullYear();
}
async function iva(pdf: PDFDocument, p: PDFPage, f: PDFFont, b: PDFFont, d: Purchase, v: Vendor, s: TaxSettings, affectedNumber: string) {
  const L = 62, R = 730, W = R - L;
  await logo(pdf, p, 64, 505, 116, 45);
  wrap(p, b, "Ley de IVA, artículo 11. " + s.ivaLegalReference, 225, 544, 330, 6.7, 9, 3);
  rect(p, 121, 473, 124, 30);
  center(p, f, "Fecha de emisión:", 183, 491, 7);
  line(p, 121, 487, 245, 487);
  center(p, f, dt(d.eventAt), 183, 477, 7.5);
  rect(p, 278, 468, 235, 35);
  center(p, b, "COMPROBANTE DE RETENCIÓN DE I.V.A.", 395.5, 493, 9.5, 230);
  line(p, 278, 488, 513, 488);
  center(p, f, s.ivaLegalReference, 395.5, 480, 5.8, 230);
  center(p, b, d.ivaCertificateNumber, 395.5, 470, 10.2, 230);
  rect(p, 572, 473, 128, 30);
  txt(p, f, "Período fiscal", 576, 493, 7);
  line(p, 572, 487, 700, 487);
  txt(p, f, "Año: " + d.period.slice(0, 4) + "    /    Mes: " + d.period.slice(5, 7), 576, 477, 7);
  ivaParty(p, f, b, 80, 463, 652, "Nombre o razón social del agente de retención:", s.companyName, s.companyRif, s.companyAddress);
  rect(p, 80, 389, 652, 9, true);
  center(p, b, "DATOS DEL PROVEEDOR", 406, 391, 7.5);
  ivaParty(p, f, b, 80, 389, 652, "Nombre o razón social del sujeto retenido:", v.name, v.rif, v.address);
  const xs = [L, 80, 122, 166, 215, 242, 269, 300, 342, 393, 436, 481, 508, 551, 590, 619, 660, 691, R];
  const top = 328, headerBottom = 293, rowBottom = 278, totalBottom = 264;
  rect(p, L, headerBottom, W, top - headerBottom, true);
  rect(p, L, rowBottom, W, headerBottom - rowBottom);
  rect(p, L, totalBottom, W, rowBottom - totalBottom);
  xs.slice(1, -1).forEach(x => line(p, x, rowBottom, x, top));
  xs.slice(8, -1).forEach(x => line(p, x, totalBottom, x, rowBottom));
  center(p, f, "Compras internas e importaciones", 537, 337, 7);
  const heads = [
    ["Oper.", "Nro."], ["Fecha del", "documento"], ["Número de", "factura"], ["Número de", "control"],
    ["No. nota", "débito"], ["No. nota", "crédito"], ["Clase de", "operación"], ["Factura", "afectada"],
    ["Monto total", "factura"], ["Sin derecho", "a crédito"], ["Base", s.ivaGeneralRate + " %"], ["Alícuota", "general"],
    ["Impuesto", s.ivaGeneralRate + " %"], ["Base", s.ivaReducedRate + " %"], ["Alícuota", "reducida"], ["Impuesto", s.ivaReducedRate + " %"],
    ["%", "retenido"], ["I.V.A.", "retenido"],
  ];
  heads.forEach((head, i) => {
    center(p, f, head[0], (xs[i] + xs[i + 1]) / 2, 313, 5.4, xs[i + 1] - xs[i] - 2);
    center(p, f, head[1], (xs[i] + xs[i + 1]) / 2, 303, 5.4, xs[i + 1] - xs[i] - 2);
  });
  const cells = [
    "1", dt(d.issuedAt), d.type === "factura" ? d.number : "", d.controlNumber,
    d.type === "nota_debito" ? d.number : "", d.type === "nota_credito" ? d.number : "",
    "1", d.type !== "factura" ? affectedNumber : "",
    fmt(d.totalCents), "0,00", fmt(d.base16Cents), s.ivaGeneralRate.toFixed(2),
    fmt(d.iva16Cents), fmt(d.base8Cents), s.ivaReducedRate.toFixed(2), fmt(d.iva8Cents),
    d.ivaRetentionRate.toFixed(2), fmt(d.ivaRetentionCents),
  ];
  cells.forEach((value, i) => center(p, f, value, (xs[i] + xs[i + 1]) / 2, 283, 5.5, xs[i + 1] - xs[i] - 2));
  right(p, b, "T O T A L", 337, 269, 6.4);
  [8, 9, 10, 12, 13, 15, 17].forEach(i => right(p, b, cells[i], xs[i + 1] - 2, 269, 5.5, xs[i + 1] - xs[i] - 4));
  txt(p, f, "Monto exento: Bs. " + fmt(d.exemptCents), L, 251, 6.5);
  rect(p, 532, 236, 135, 11);
  rect(p, 532, 236, 72, 11, true);
  txt(p, b, "Total a pagar  Bs.:", 534, 239, 6.7);
  right(p, b, fmt(d.totalCents - d.ivaRetentionCents), 665, 239, 7.5);
  line(p, 80, 174, 226, 174);
  line(p, 370, 174, 610, 174);
  await scannedImage(pdf, p, "upco-signature.png", 110, 174, 88);
  await scannedImage(pdf, p, "upco-seal.png", 197, 101, 137);
  center(p, b, "Agente de retención", 153, 164, 7);
  center(p, f, s.companyName, 153, 153, 6, 160);
  center(p, f, s.companyRif, 153, 143, 6);
  center(p, b, "Sujeto retenido", 490, 164, 7);
  center(p, f, v.name, 490, 153, 6, 240);
  center(p, f, v.rif, 490, 143, 6);
  txt(p, f, "Fecha de entrega: " + dt(d.eventAt), 80, 119, 6.5);
  txt(p, f, "Fecha de recepción: ____/____/________", 433, 119, 6.5);
  right(p, f, "Página 1 de 1", R, 24, 6);
}
async function islr(pdf: PDFDocument, p: PDFPage, f: PDFFont, b: PDFFont, d: Purchase, v: Vendor, s: TaxSettings, affectedNumber: string) {
  const L = 54, R = 558, W = R - L;
  await logo(pdf, p, 232, 652, 148, 55);
  center(p, b, "NRO. COMPROBANTE DE RETENCIÓN", 306, 641, 10.1);
  center(p, b, d.islrCertificateNumber, 306, 625, 11.2);
  center(p, b, "CONSTANCIA DE RETENCIÓN DE IMPUESTOS SOBRE LA RENTA", 306, 606, 8.8);
  islrParty(p, f, b, L, 595, W, "DATOS DEL AGENTE DE RETENCIÓN", s.companyName, s.companyRif, "Persona jurídica", s.companyAddress, "");
  center(p, f, "Hacemos constar que hemos retenido el IMPUESTO SOBRE LA RENTA a:", 306, 515, 7.8);
  const person = v.personType === "natural"
    ? (v.residency === "residente" ? "Persona natural residente" : "Persona natural no residente")
    : (v.residency === "domiciliada" ? "Persona jurídica domiciliada" : "Persona jurídica no domiciliada");
  islrParty(p, f, b, L, 503, W, "DATOS DEL BENEFICIARIO", v.name, v.rif, person, v.address, v.phone || "");
  center(p, f, periodLabel(d.eventAt), 306, 420, 9);
  rect(p, L, 295, W, 106);
  rect(p, L, 384, W, 17, true);
  const topXs = [L, 114, 166, 218, 390, R];
  topXs.slice(1, -1).forEach(x => line(p, x, 347, x, 401));
  ["FECHA", "FACTURA", "CONTROL", "DETALLE DE LA FACTURA", "CONCEPTO DE RETENCIÓN"].forEach((head, i) =>
    center(p, b, head, (topXs[i] + topXs[i + 1]) / 2, 390, 7.2, topXs[i + 1] - topXs[i] - 3));
  line(p, L, 384, R, 384);
  line(p, L, 347, R, 347);
  const concept = ISLR_CONCEPTS.find(item => item.code === d.islrConceptCode);
  center(p, f, dt(d.issuedAt), 84, 372, 7, 58);
  center(p, f, d.number, 140, 372, 7, 50);
  center(p, f, d.controlNumber, 192, 372, 6.8, 50);
  const detail = d.type === "factura" ? d.description : (d.type === "nota_credito" ? "Nota de crédito" : "Nota de débito") + (affectedNumber ? " a factura " + affectedNumber : "") + ". " + d.description;
  wrap(p, f, detail || "Compra", 221, 377, 166, 5.8, 7.2, 4);
  wrap(p, f, d.islrConceptCode + " - " + (concept?.description || ""), 393, 377, 162, 5.8, 7.2, 4);
  line(p, L, 333, R, 333);
  line(p, L, 327, R, 327);
  const amtXs = [218, 305, 390, 411, 483, R];
  rect(p, 218, 311, R - 218, 16, true);
  amtXs.slice(1, -1).forEach(x => line(p, x, 295, x, 327));
  ["TOTAL DOCUMENTO", "BASE IMPONIBLE", "%", "SUSTRAENDO", "MONTO RETENIDO"].forEach((head, i) =>
    center(p, b, head, (amtXs[i] + amtXs[i + 1]) / 2, 316, 6.5, amtXs[i + 1] - amtXs[i] - 3));
  center(p, b, "TOTAL FACTURADO", 136, 301, 7.5);
  right(p, f, fmt(d.totalCents), 303, 301, 8.2);
  right(p, f, fmt(d.islrBaseCents), 388, 301, 8.2);
  center(p, f, d.islrRate.toFixed(2), 400, 301, 7.6);
  right(p, f, fmt(d.islrSubtractionCents), 481, 301, 8.2);
  right(p, f, fmt(d.islrRetentionCents), 556, 301, 8.2);
  txt(p, f, dt(d.eventAt), L + 2, 282, 8);
  right(p, b, "T O T A L   A   P A G A R   Bs.", 482, 282, 8.5);
  rect(p, 483, 274, R - 483, 21, true);
  right(p, b, fmt(d.totalCents - d.ivaRetentionCents - d.islrRetentionCents), R - 3, 281, 8.8);
  line(p, 221, 211, 391, 211);
  await scannedImage(pdf, p, "upco-signature.png", 251, 212, 92);
  await scannedImage(pdf, p, "upco-seal.png", 375, 175, 143);
  center(p, b, "Firma y sello del agente de retención", 306, 199, 8);
  center(p, b, s.companyRif, 306, 186, 7.5);
  wrap(p, f, s.islrLegalReference, 60, 161, 492, 6.6, 8.3, 3);
  right(p, f, "Página 1 de 1", R, 25, 6);
}
export async function makeRetentionPdf(kind: "iva" | "islr", d: Purchase, v: Vendor, settings: TaxSettings, affectedNumber = ""): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(kind === "iva" ? "Comprobante de retención de IVA" : "Constancia de retención de ISLR");
  pdf.setAuthor(settings.companyName);
  const page = pdf.addPage(kind === "iva" ? [792, 612] : [612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  if (kind === "iva") await iva(pdf, page, font, bold, d, v, settings, affectedNumber);
  else await islr(pdf, page, font, bold, d, v, settings, affectedNumber);
  return pdf.save();
}

// One browser download carries both certificates. Browsers commonly block the
// second automatic file download after an asynchronous issuance request.
export async function makeCombinedRetentionPdf(d: Purchase, v: Vendor, settings: TaxSettings, affectedNumber = ""): Promise<Uint8Array> {
  const combined = await PDFDocument.create();
  combined.setTitle("Comprobantes de retención IVA e ISLR");
  combined.setAuthor(settings.companyName);
  for (const kind of ["iva", "islr"] as const) {
    const source = await PDFDocument.load(await makeRetentionPdf(kind, d, v, settings, affectedNumber));
    const pages = await combined.copyPages(source, source.getPageIndices());
    for (const page of pages) combined.addPage(page);
  }
  return combined.save();
}
