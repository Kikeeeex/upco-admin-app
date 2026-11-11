import { ImportPreview } from "@/components/administration/import-preview";

export default function ImportacionesPage() {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN V2.7</span><h1>Importaciones</h1><p>Revisa estructura y contenido de archivos históricos.</p></div>
    <div className="administration-lock-note"><strong>Importación histórica transaccional:</strong> el servidor contrasta proveedores, configuración fiscal, cálculos, duplicados, comprobantes originales y facturas relacionadas al validar y vuelve a hacer esas comprobaciones al confirmar. Si una fila falla, revierte el lote completo. No crea comprobantes ni nuevos correlativos.</div>
    <ImportPreview />
  </div>;
}
