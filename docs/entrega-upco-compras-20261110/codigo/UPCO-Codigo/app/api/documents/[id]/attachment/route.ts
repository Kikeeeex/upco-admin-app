import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb } from "@/db";
import { documents } from "@/db/schema";
import { InputError } from "@/lib/tax/core";
import { apiError, apiUser, audit, findDocument } from "@/lib/tax/server";

type Context = { params: Promise<{ id: string }> };
const maxBytes = 10 * 1024 * 1024;
const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
async function target(context: Context) {
  const { id } = await context.params;
  const document = await findDocument(Number(id));
  if (!document) throw new InputError("Documento no encontrado");
  return { document, file: path.join(dataDir, "attachments", String(document.id), "support") };
}
export async function PUT(request: Request, context: Context) {
  const denied = await apiUser("documents.edit"); if (denied) return denied;
  try {
    const { document, file } = await target(context);
    if (document.status !== "draft") throw new InputError("Adjunte el soporte antes de emitir el documento");
    const type = (request.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
    if (!allowed.has(type)) throw new InputError("Adjunte PDF, JPG, PNG o WEBP");
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > maxBytes) throw new InputError("El soporte no puede superar 10 MB");
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new InputError("El soporte debe tener entre 1 byte y 10 MB");
    const head = new Uint8Array(bytes.slice(0, 16));
    const ascii = new TextDecoder().decode(head);
    const valid = type === "application/pdf" ? ascii.startsWith("%PDF-") :
      type === "image/jpeg" ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff :
      type === "image/png" ? head[0] === 0x89 && ascii.slice(1, 4) === "PNG" :
      ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    if (!valid) throw new InputError("El contenido del archivo no coincide con su formato");
    const filename = (request.headers.get("x-file-name") ?? "soporte").replace(/[\\/\r\n"]/g, "_").slice(0, 120);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(bytes));
    await getDb().update(documents).set({ attachmentName: filename, attachmentType: type, attachmentSize: bytes.byteLength }).where(eq(documents.id, document.id));
    await audit("document", document.id, "support_uploaded", { filename, type, size: bytes.byteLength });
    return Response.json({ attached: true, filename, type, size: bytes.byteLength });
  } catch (error) { return apiError(error); }
}
export async function GET(_request: Request, context: Context) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const { document, file } = await target(context);
    if (!document.attachmentName) return Response.json({ error: "Soporte no encontrado" }, { status: 404 });
    const bytes = await readFile(/*turbopackIgnore: true*/ file).catch(() => null);
    if (!bytes) return Response.json({ error: "Soporte no encontrado" }, { status: 404 });
    return new Response(bytes, { headers: {
      "Content-Type": document.attachmentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${document.attachmentName}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, context: Context) {
  const denied = await apiUser("documents.edit"); if (denied) return denied;
  try {
    const { document, file } = await target(context);
    if (document.status !== "draft") throw new InputError("El soporte de un documento emitido no puede eliminarse");
    await rm(file, { force: true });
    await getDb().update(documents).set({ attachmentName: "", attachmentType: "", attachmentSize: 0 }).where(eq(documents.id, document.id));
    await audit("document", document.id, "support_deleted", {});
    return Response.json({ attached: false });
  } catch (error) { return apiError(error); }
}
