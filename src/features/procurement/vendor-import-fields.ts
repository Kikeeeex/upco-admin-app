export const vendorImportFields = [
  { key: "name", label: "Proveedor" }, { key: "country", label: "País" },
  { key: "taxIdentifier", label: "RIF / identificación fiscal" }, { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo electrónico" }, { key: "salesArea", label: "Área de venta" },
  { key: "contactPerson", label: "Persona de contacto" }, { key: "website", label: "Sitio web" },
  { key: "city", label: "Ciudad" }, { key: "productsServicesDetail", label: "Detalle de productos y servicios" },
] as const;
export type VendorImportField = typeof vendorImportFields[number]["key"];
export type VendorImportMapping = Partial<Record<VendorImportField, number>>;
