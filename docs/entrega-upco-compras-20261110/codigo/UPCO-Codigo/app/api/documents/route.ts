import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, vendors } from "@/db/schema";
import { calculateDocument, fail, type VendorInput } from "@/lib/tax/core";
import { apiError, apiUser, audit, findDocument, findVendor, issueDocument, readSettings, toDocument } from "@/lib/tax/server";

export async function GET(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const filters = [];
    const period = params.get("period"); if (period) filters.push(eq(documents.period, period));
    const half = params.get("half"); if (half) filters.push(eq(documents.half, Number(half)));
    const vendorId = params.get("vendorId"); if (vendorId) filters.push(eq(documents.vendorId, Number(vendorId)));
    const status = params.get("status"); if (status) filters.push(eq(documents.status, status));
    const db = getDb();
    const rows = await db.select({ document: documents, vendorName: vendors.name }).from(documents).innerJoin(vendors, eq(documents.vendorId, vendors.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(documents.issuedAt), desc(documents.id));
    return Response.json({ items: rows.map(x => toDocument(x.document, x.vendorName)) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const denied = await apiUser("documents.create"); if (denied) return denied;
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (payload.status === "issued") { const issueDenied = await apiUser("documents.issue"); if (issueDenied) return issueDenied; }
    const vendorId = Number(payload.vendorId);
    const vendor = await findVendor(vendorId);
    if (!vendor || !vendor.active) fail("Seleccione un proveedor activo");
    if (payload.type === "nota_credito" || payload.type === "nota_debito") {
      const affected = await findDocument(Number(payload.affectedDocumentId));
      if (!affected || affected.vendorId !== vendorId || affected.type !== "factura" || affected.status !== "issued") fail("La nota debe afectar una factura emitida del mismo proveedor");
    }
    const settings = await readSettings();
    const values = calculateDocument(payload, vendor as VendorInput, settings);
    if (!["draft", "issued"].includes(values.status)) fail("Estado inválido");
    const shouldIssue = values.status === "issued";
    if (shouldIssue && values.type !== "factura" && values.islrApplies) fail("La emisión de notas con ISLR está pendiente de validar su tratamiento en el portal; conserve la nota como borrador");
    const db = getDb();
    const [created] = await db.insert(documents).values({ ...values, vendorId, status: "draft" }).returning();
    await audit("document", created.id, "created", created);
    const row = shouldIssue ? await issueDocument(created) : created;
    return Response.json(toDocument(row, vendor.name), { status: 201 });
  } catch (error) { return apiError(error); }
}
