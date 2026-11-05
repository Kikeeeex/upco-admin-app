import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { VendorImportWizard } from "@/components/vendor-import-wizard";

export default async function ImportVendorsPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">PROCURA</span><h1>Importar proveedores</h1>
      <p>Revisa el archivo y confirma los cambios antes de guardar el directorio.</p></div>
    <p><Link className="text-link" href="/procura#proveedores">← Volver a proveedores</Link></p>
    <VendorImportWizard />
  </div>;
}
