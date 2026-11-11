export type RetentionTax = "iva" | "islr" | "combined";

function cleanPart(value: string): string {
  return value.normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim().slice(0, 100);
}

export function retentionFilename(vendorName: string, invoiceNumber: string, tax: RetentionTax): string {
  const name = cleanPart(vendorName) || "Proveedor";
  const invoice = cleanPart(invoiceNumber) || "sin numero";
  const label = tax === "iva" ? "IVA retenido" : tax === "islr" ? "ISLR retenido" : "IVA e ISLR retenidos";
  return `${name} - Fact. Nro. ${invoice} - ${label}.pdf`;
}

export function retentionDisposition(vendorName: string, invoiceNumber: string, tax: RetentionTax, mode: "inline" | "attachment" = "attachment") {
  const file = retentionFilename(vendorName, invoiceNumber, tax);
  const ascii = file.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${mode}; filename*=UTF-8''${encodeURIComponent(file)}; filename="${ascii}"`;
}
