import Link from "next/link";
import Image from "next/image";
import { getAccessContext } from "@/features/auth/access";
import { localDateInTimezone } from "@/features/work-items/filters";
import { dailyBuckets } from "@/features/work-items/daily";
import { DailyPanel, type DailyItem } from "@/components/daily-panel";
import { loadPendingAdminFollowUps } from "@/features/administration/agenda";
import { FollowUpAgenda } from "@/components/follow-up-list";

export default async function InicioPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const profile = await access.supabase.from("user_profiles")
    .select("timezone")
    .eq("user_id", access.user.id)
    .maybeSingle();
  const today = localDateInTimezone(new Date(), profile.data?.timezone ?? "America/Caracas");
  const buckets = dailyBuckets(today);
  const results = await Promise.all(buckets.map(async (bucket) => {
    let query = access.supabase.from("work_items")
      .select("id, code, title, due_date", { count: "exact" })
      .eq("organization_id", access.organizationId)
      .is("archived_at", null)
      .in("status", bucket.statuses);
    if (bucket.dateFilter?.operator === "eq") query = query.eq("due_date", bucket.dateFilter.value);
    if (bucket.dateFilter?.operator === "lt") query = query.lt("due_date", bucket.dateFilter.value);
    const result = await query.order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(0, 4);
    return { bucket, count: result.count, items: (result.data ?? []) as DailyItem[], error: Boolean(profile.error || result.error) || result.count === null };
  }));
  const agenda = await loadPendingAdminFollowUps(access, 5);

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">TU ESPACIO DE TRABAJO</span><h1>Inicio</h1><p>Gestiona tus actividades y mantén a la vista lo que sigue.</p></div>
    <section className="welcome-card"><div><span className="eyebrow light">REVISIÓN DIARIA</span><h2>Tu trabajo, en un vistazo.</h2><p>Revisa lo que vence hoy, lo atrasado y lo que espera una respuesta.</p><Link href="/mi-trabajo" className="light-button">Ir a Mi trabajo <span aria-hidden="true">→</span></Link></div><Image src="/brand/upco-logo-light.png" alt="" width={260} height={107} className="welcome-logo" /></section>
    <div className="daily-grid">{results.map((result) => <DailyPanel key={result.bucket.key} {...result} />)}</div>
    <section className="work-card follow-up-section"><h2>Próximos seguimientos</h2>
      {agenda.error ? <p role="alert" className="error-message">No se pudieron cargar los seguimientos.</p> : <FollowUpAgenda today={today} items={agenda.items} />}
      <Link href="/seguimientos" className="text-link">Ver agenda completa →</Link>
    </section>
    <div className="overview-grid"><section className="overview-card"><span className="card-glyph">◫</span><h2>Mi trabajo</h2><p>Consulta y registra tus actividades.</p><Link href="/mi-trabajo">Abrir área →</Link></section><section className="overview-card"><span className="card-glyph">◎</span><h2>Seguimientos</h2><p>Revisa los compromisos administrativos pendientes.</p><Link href="/seguimientos">Abrir agenda →</Link></section><section className="overview-card"><span className="card-glyph">▥</span><h2>Proyectos</h2><p>La gestión de proyectos está pendiente de implementación.</p><Link href="/proyectos">Ver estado →</Link></section></div>
  </div>;
}
