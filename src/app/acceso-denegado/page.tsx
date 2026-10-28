import Link from "next/link";

export default function DeniedPage() {
  return <main className="message-screen"><div className="message-card"><span className="eyebrow">ACCESO RESTRINGIDO</span><h1>No tienes acceso a UPCO Admin</h1><p>Tu cuenta no figura como habilitada para este espacio. Consulta al administrador si necesitas acceso.</p><Link href="/login" className="primary-button">Volver al acceso</Link></div></main>;
}
