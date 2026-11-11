"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/access";
import { importHistoricalDocumentsFile, validateHistoricalImportFile, type HistoricalImportValidation } from "./validation";

export async function validateHistoricalImportAction(form: FormData): Promise<HistoricalImportValidation> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") {
    return { kind: "error", message: "La validación histórica está disponible solo para administradores activos." };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { kind: "error", message: "Selecciona un archivo CSV o XLSX." };
  return validateHistoricalImportFile(file, access);
}

export async function importHistoricalDocumentsAction(form: FormData): Promise<HistoricalImportValidation> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") {
    return { kind: "error", message: "La importación histórica está disponible solo para administradores activos." };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { kind: "error", message: "Selecciona un archivo CSV o XLSX." };
  const acknowledgeWarnings = form.get("acknowledgeWarnings") === "on";
  const result = await importHistoricalDocumentsFile(file, access, acknowledgeWarnings);
  if (result.imported) {
    revalidatePath("/administracion/compras");
    revalidatePath("/administracion/retenciones");
    revalidatePath("/administracion/libros");
    revalidatePath("/administracion/reportes");
    revalidatePath("/administracion");
  }
  return result;
}
