import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { fail } from "@/lib/tax/core";
import { importDocuments, inspectImportFile } from "@/lib/tax/importDocuments";

export async function POST(request: Request) {
  const denied = await apiUser("imports.run"); if (denied) return denied;
  try {
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode !== "preview" && mode !== "commit") fail("Seleccione preview o commit");
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 5_500_000) fail("El archivo supera 5 MB");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) fail("Seleccione una plantilla .xlsx o .csv");
    if (file.size > 5_000_000) fail("El archivo supera 5 MB");
    const data = new Uint8Array(await file.arrayBuffer());
    const settings = await readSettings();
    if (mode === "preview") {
      const { rows, summary } = await inspectImportFile(data, file.name, settings);
      return Response.json({ rows, summary });
    }
    return Response.json(await importDocuments(data, file.name, settings), { status: 201 });
  } catch (error) { return apiError(error); }
}
