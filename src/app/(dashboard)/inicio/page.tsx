import Link from "next/link";

export default function InicioPage() {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">TU ESPACIO DE TRABAJO</span><h1>Inicio</h1><p>Gestiona tus actividades y mantén a la vista lo que sigue.</p></div>
    <section className="welcome-card"><div><span className="eyebrow light">PRIMEROS PASOS</span><h2>Todo empieza con una actividad.</h2><p>Registra un pendiente y organiza su prioridad y fecha límite desde Mi trabajo.</p><Link href="/mi-trabajo" className="light-button">Ir a Mi trabajo <span aria-hidden="true">→</span></Link></div><div className="welcome-symbol" aria-hidden="true">U</div></section>
    <div className="overview-grid"><section className="overview-card"><span className="card-glyph">◫</span><h2>Mi trabajo</h2><p>Consulta y registra tus actividades.</p><Link href="/mi-trabajo">Abrir área →</Link></section><section className="overview-card"><span className="card-glyph">◎</span><h2>Seguimientos</h2><p>La agenda de contactos estará disponible en una entrega posterior.</p><Link href="/seguimientos">Ver estado →</Link></section><section className="overview-card"><span className="card-glyph">▥</span><h2>Proyectos</h2><p>La gestión de proyectos está pendiente de implementación.</p><Link href="/proyectos">Ver estado →</Link></section></div>
  </div>;
}
