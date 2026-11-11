import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getAccessContext } from "@/features/auth/access";

type Snapshot = Record<string, unknown>;

function pngAsset(value: string | undefined): Buffer | null {
  if (!value) return null;
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? buffer : null;
  } catch { return null; }
}

function money(value: unknown): string {
  const cents = Number(value);
  return Number.isSafeInteger(cents) ? (cents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";
}

function text(value: unknown): string {
  return String(value ?? "—").replace(/[\r\n]+/g, " ").slice(0, 400);
}

async function renderCertificate(args: {
  kind: "iva" | "islr"; number: string; calculation: Snapshot; vendor: Snapshot;
  document: Snapshot; signature: Buffer; seal: Buffer;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 48, info: { Title: `Comprobante de retención ${args.kind.toUpperCase()}`, Author: "UPCO" } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const title = args.kind === "iva" ? "COMPROBANTE DE RETENCIÓN DE IVA" : "COMPROBANTE DE RETENCIÓN DE ISLR";
  const vendor = args.vendor;
  const calculation = args.calculation;
  const document = args.document;
  doc.image(args.seal, 48, 38, { fit: [250, 78] });
  doc.font("Helvetica-Bold").fontSize(15).text(title, 48, 132, { align: "center" });
  doc.moveDown(0.5).font("Helvetica").fontSize(10)
    .text(`Comprobante N.º: ${args.number}`, { align: "right" })
    .text(`Período: ${text(calculation.period)} · Quincena ${text(calculation.half)}`, { align: "right" });
  doc.moveDown().font("Helvetica-Bold").fontSize(11).text("Agente de retención");
  doc.font("Helvetica").fontSize(10).text("UPCO de Venezuela Consultores, S.A.").text("RIF: J-30817539-0");
  doc.moveDown().font("Helvetica-Bold").fontSize(11).text("Sujeto retenido");
  doc.font("Helvetica").fontSize(10).text(`Razón social: ${text(vendor.legal_name)}`)
    .text(`RIF: ${text(vendor.tax_identifier)}`)
    .text(`Domicilio fiscal: ${text(vendor.tax_address)}`);
  doc.moveDown().font("Helvetica-Bold").fontSize(11).text("Documento relacionado");
  doc.font("Helvetica").fontSize(10).text(`Factura: ${text(document.invoice_number)}`)
    .text(`Control: ${text(document.control_number)}`)
    .text(`Fecha de emisión: ${text(document.issued_at)} · Fecha de pago/abono: ${text(document.event_at)}`)
    .text(`Descripción: ${text(document.description)}`);
  doc.moveDown().font("Helvetica-Bold").fontSize(11).text("Cálculo de la retención");
  const rows: Array<[string, string]> = args.kind === "iva"
    ? [
      ["Base imponible 16 %", money(calculation.base16Cents)], ["IVA 16 %", money(calculation.iva16Cents)],
      ["Base imponible 8 %", money(calculation.base8Cents)], ["IVA 8 %", money(calculation.iva8Cents)],
      ["Porcentaje retenido", `${text(calculation.ivaRetentionRate)} %`], ["IVA retenido", money(calculation.ivaRetentionCents)],
    ]
    : [
      ["Base ISLR", money(calculation.islrBaseCents)], ["Base sujeta", money(calculation.islrTaxableBaseCents)],
      ["Concepto ISLR", text(calculation.islrConceptCode)], ["Alícuota", `${text(calculation.islrRate)} %`],
      ["Sustracción", money(calculation.islrSubtractionCents)], ["ISLR retenido", money(calculation.islrRetentionCents)],
    ];
  doc.moveDown(0.5);
  for (const [label, value] of rows) {
    doc.font("Helvetica").fontSize(10).text(label, 56, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(value, { align: "right" });
    doc.moveDown(0.25);
  }
  doc.moveDown().font("Helvetica").fontSize(9).text("Documento generado por UPCO Admin. Verifique la información antes de su uso tributario.", { align: "center" });
  const y = Math.min(doc.page.height - 125, doc.y + 34);
  doc.image(args.signature, 115, y, { fit: [210, 64] });
  doc.moveTo(88, y + 70).lineTo(350, y + 70).strokeColor("#666666").stroke();
  doc.font("Helvetica").fontSize(9).text("Firma autorizada", 88, y + 75, { width: 262, align: "center" });
  doc.end();
  return finished;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Documento inválido" }, { status: 400 });
  const kind = new URL(request.url).searchParams.get("tipo");
  if (kind !== "iva" && kind !== "islr") return NextResponse.json({ error: "Tipo de comprobante inválido" }, { status: 400 });
  const { data: row, error } = await access.supabase.from("administration_documents")
    .select("id,organization_id,fiscal_vendor_id,document_type,invoice_number,control_number,issued_at,event_at,status,description,calculation_snapshot,iva_certificate_number,islr_certificate_number")
    .eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  const certNumber = kind === "iva" ? row?.iva_certificate_number : row?.islr_certificate_number;
  if (error || !row || row.status !== "issued" || !certNumber || !row.fiscal_vendor_id) {
    return NextResponse.json({ error: "No hay un comprobante emitido disponible para este tipo" }, { status: 404 });
  }
  const [{ data: vendor }, seal, signature] = await Promise.all([
    access.supabase.from("fiscal_vendors").select("legal_name,tax_identifier,tax_address").eq("id", row.fiscal_vendor_id).eq("organization_id", access.organizationId).maybeSingle(),
    Promise.resolve(pngAsset(process.env.UPCO_RETENTION_SEAL_PNG_BASE64)),
    Promise.resolve(pngAsset(process.env.UPCO_RETENTION_SIGNATURE_PNG_BASE64)),
  ]);
  if (!vendor || !seal || !signature) return NextResponse.json({ error: "Los activos privados de firma y sello no están configurados" }, { status: 503 });
  const pdf = await renderCertificate({
    kind, number: certNumber,
    calculation: row.calculation_snapshot as Snapshot,
    vendor: vendor as Snapshot,
    document: row as Snapshot, signature, seal,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="UPCO-${kind.toUpperCase()}-${certNumber}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
