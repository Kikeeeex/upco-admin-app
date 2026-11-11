import { ImportPreview } from "@/components/administration/import-preview";

export default function ImportacionesPage() {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.6</span><h1>Importaciones</h1><p>Revisa estructura y contenido de archivos históricos.</p></div>
    <div className="administration-lock-note"><strong>Importación histórica en validación:</strong> puedes revisar el archivo en el navegador y pedir al servidor que contraste proveedores, configuración fiscal, cálculos, duplicados, comprobantes y facturas relacionadas. La validación no importa documentos ni asigna correlativos.</div>
    <ImportPreview />
  </div>;
}
