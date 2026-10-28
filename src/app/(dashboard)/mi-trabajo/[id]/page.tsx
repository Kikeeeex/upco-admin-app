import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseWorkItemId } from "@/features/work-items/rules";
import { formatWorkItemDateTime, parsePageNumber } from "@/features/work-items/presentation";
import { ArchiveWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";
import { WorkItemHistory, type ListedHistoryEvent } from "@/components/work-item-history";

const PAGE_SIZE = 50;
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };

type DetailItem = ListedWorkItem & {
  creator_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default async function WorkItemDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventos?: string | string[] }>;
}) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") notFound();

  let id: string;
  try { id = parseWorkItemId((await params).id); }
  catch { notFound(); }

  const eventPage = parsePageNumber((await searchParams).eventos);
  const [itemResult, profileResult] = await Promise.all([
    access.supabase.from("work_items")
      .select("id, code, type, title, description, status, priority, due_date, closed_at, archived_at, creator_id, created_at, updated_at")
      .eq("id", id)
      .eq("organization_id", access.organizationId)
      .maybeSingle(),
    access.supabase.from("user_profiles")
      .select("timezone, display_name")
      .eq("user_id", access.user.id)
      .maybeSingle(),
  ]);
  if (itemResult.error || !itemResult.data) notFound();
  const item = itemResult.data as DetailItem;
  const timezone = profileResult.data?.timezone ?? "America/Caracas";
  const isOwner = item.creator_id === access.user.id;

  const historyResult = await access.supabase.from("activity_log")
    .select("id, work_item_id, action, before_values, after_values, actor_id, occurred_at")
    .eq("organization_id", access.organizationId)
    .eq("work_item_id", id)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range((eventPage - 1) * PAGE_SIZE, eventPage * PAGE_SIZE);
  const historyRows = (historyResult.data ?? []) as ListedHistoryEvent[];
  const events = historyRows.slice(0, PAGE_SIZE);
  const actorIds = [...new Set(events.map((event) => event.actor_id))];
  const actorProfiles = actorIds.length ? await access.supabase.from("user_profiles")
    .select("user_id, display_name")
    .in("user_id", actorIds) : { data: [], error: null };
  const actorNames: Record<string, string> = {};
  for (const profile of actorProfiles.data ?? []) {
    if (profile.display_name?.trim()) actorNames[profile.user_id] = profile.display_name;
  }
  if (!actorNames[access.user.id]) actorNames[access.user.id] = "Tú";

  return <div className="page-content">
    <div className="page-heading"><Link href="/mi-trabajo" className="text-link">← Mi trabajo</Link><span className="eyebrow">{item.code}</span><h1>{item.title}</h1><p>Consulta la actividad y sus cambios.</p></div>
    <section className="work-card detail-card">
      <h2>Ficha de actividad</h2>
      <dl className="detail-grid">
        <div><dt>Estado</dt><dd>{statusLabels[item.status] ?? item.status}</dd></div>
        <div><dt>Prioridad</dt><dd>{priorityLabels[item.priority] ?? item.priority}</dd></div>
        <div><dt>Fecha límite</dt><dd>{item.due_date ?? "—"}</dd></div>
        <div><dt>Cierre</dt><dd>{formatWorkItemDateTime(item.closed_at, timezone)}</dd></div>
        <div><dt>Creada</dt><dd>{formatWorkItemDateTime(item.created_at, timezone)}</dd></div>
        <div><dt>Actualizada</dt><dd>{formatWorkItemDateTime(item.updated_at, timezone)}</dd></div>
      </dl>
      {item.description && <p className="detail-description">{item.description}</p>}
      {isOwner && <div className="detail-actions">{item.archived_at ? <ArchiveWorkItemForm id={item.id} archived /> : <><EditWorkItemForm item={item} /><ArchiveWorkItemForm id={item.id} archived={false} /></>}</div>}
    </section>
    <section className="work-card work-list">
      <WorkItemHistory id={id} events={events} error={Boolean(historyResult.error)} actorNames={actorNames} timezone={timezone} canAddNote={isOwner && !item.archived_at} />
      {!historyResult.error && (eventPage > 1 || historyRows.length > PAGE_SIZE) &&
        <nav className="pagination" aria-label="Páginas del historial">
          {eventPage > 1 && <Link href={`/mi-trabajo/${id}?eventos=${eventPage - 1}`}>← Eventos recientes</Link>}
          <span>Página {eventPage}</span>
          {historyRows.length > PAGE_SIZE && <Link href={`/mi-trabajo/${id}?eventos=${eventPage + 1}`}>Eventos anteriores →</Link>}
        </nav>}
    </section>
  </div>;
}
