import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { loadPendingAdminFollowUps } from "@/features/administration/agenda";
import { localDateInTimezone } from "@/features/work-items/filters";
import { FollowUpAgenda } from "@/components/follow-up-list";
import { parsePageNumber } from "@/features/work-items/presentation";

export default async function SeguimientosPage({ searchParams }: { searchParams?: Promise<{ pagina?: string | string[] }> } = {}) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const page = parsePageNumber((await searchParams)?.pagina);
  const [profile, agenda] = await Promise.all([
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
    loadPendingAdminFollowUps(access, 50, page),
  ]);
  const today = localDateInTimezone(new Date(), profile.data?.timezone ?? "America/Caracas");
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">COMPROMISOS</span><h1>Seguimientos</h1><p>Agenda de seguimientos pendientes de gestiones administrativas.</p></div>
    <section className="work-card"><h2>Agenda de seguimientos</h2>
      {agenda.error ? <p role="alert" className="error-message">No se pudo cargar la agenda.</p> : <FollowUpAgenda today={today} items={agenda.items} />}
      {!agenda.error && (page > 1 || agenda.hasNext) && <nav className="pagination" aria-label="Páginas de seguimientos">
        {page > 1 && <Link href={`/seguimientos?pagina=${page - 1}`}>← Anterior</Link>}
        <span>Página {page}</span>
        {agenda.hasNext && <Link href={`/seguimientos?pagina=${page + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
  </div>;
}
