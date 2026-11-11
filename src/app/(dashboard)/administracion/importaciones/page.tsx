import { ImportPreview } from "@/components/administration/import-preview";

export default function ImportacionesPage() {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.5</span><h1>Importaciones</h1><p>Revisa estructura y contenido de archivos históricos.</p></div>
    <div className="administration-lock-note"><strong>Confirmación histórica pendiente:</strong> la vista previa valida estructura y campos básicos en el navegador. La importación de documentos históricos todavía no escribe en la base ni asigna correlativos.</div>
    <ImportPreview />
  </div>;
}
