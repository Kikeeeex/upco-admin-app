import Link from "next/link";

export default function AdministrationAccessDeniedPage() {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN</span><h1>Acceso no asignado</h1><p>No tienes permisos para consultar este submódulo.</p></div>
    <section className="work-card"><p>Solicita a una persona administradora de UPCO que te asigne las capacidades necesarias. Los permisos se aplican inmediatamente y no habilitan emisión, anulación, activación fiscal ni importación de datos.</p><Link className="text-link" href="/inicio">Volver al inicio</Link></section>
  </div>;
}
