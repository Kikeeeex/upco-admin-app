"use server";

import { getAccessContext } from "@/features/auth/access";
import { validateHistoricalImportFile, type HistoricalImportValidation } from "./validation";

export async function validateHistoricalImportAction(form: FormData): Promise<HistoricalImportValidation> {
  const access = await getAccessContext();
  if (access.kind !== "allowed" || access.role !== "admin") {
    return { kind: "error", message: "La validación histórica está disponible solo para administradores activos." };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { kind: "error", message: "Selecciona un archivo CSV o XLSX." };
  return validateHistoricalImportFile(file, access);
}
