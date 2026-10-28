import Link from "next/link";

export function PendingPage({ title }: { title: string }) {
  return (
    <div className="page-content">
      <div className="page-heading"><span className="eyebrow">ÁREA DE TRABAJO</span><h1>{title}</h1><p>Este módulo está pendiente de implementación.</p></div>
      <section className="empty-card" aria-label="Estado del módulo">
        <span className="empty-icon" aria-hidden="true">◇</span>
        <h2>Próximamente en UPCO Admin</h2>
        <p>Las operaciones de {title.toLowerCase()} se incorporarán por etapas. Aquí no se muestran datos de ejemplo como si fueran registros reales.</p>
        <Link href="/mi-trabajo" className="text-link">Ir a Mi trabajo <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
