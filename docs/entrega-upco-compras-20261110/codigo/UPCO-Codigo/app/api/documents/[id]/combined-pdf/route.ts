import { InputError, type TaxSettings } from "@/lib/tax/core";
import { makeCombinedRetentionPdf } from "@/lib/tax/pdf";
import { retentionDisposition } from "@/lib/tax/retentionFilename";
import { apiError, apiUser, assertOriginalCertificate, findDocument, findVendor, readSettings } from "@/lib/tax/server";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const { id } = await context.params;
    const doc = await findDocument(Number(id));
    if (!doc) throw new InputError("Documento no encontrado");
    assertOriginalCertificate(doc);
    if (doc.status !== "issued" || !doc.ivaCertificateNumber || !doc.islrCertificateNumber || doc.ivaRetentionCents === 0 || doc.islrRetentionCents === 0) {
      throw new InputError("Este documento no tiene ambas retenciones emitidas");
    }
    const vendor = await findVendor(doc.vendorId);
    if (!vendor) throw new InputError("Proveedor no encontrado");
    const affected = doc.affectedDocumentId ? await findDocument(doc.affectedDocumentId) : null;
    const affectedNumber = affected?.vendorId === doc.vendorId ? affected.number : "";
    const settings = doc.settingsSnapshot ? JSON.parse(doc.settingsSnapshot) as TaxSettings : await readSettings();
    const pdf = await makeCombinedRetentionPdf(doc, vendor, settings, affectedNumber);
    return new Response(pdf as unknown as BodyInit, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": retentionDisposition(vendor.name, doc.number, "combined"),
      "Cache-Control": "private, no-store",
    } });
  } catch (error) { return apiError(error); }
}
