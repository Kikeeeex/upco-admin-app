import { getAccessContext } from "@/features/auth/access";
import { ArchiveWorkItemForm, CreateWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";
import { WorkItemHistory, type ListedHistoryEvent } from "@/components/work-item-history";

const areaLabels: Record<string, string> = { general: "General", administration: "Administración", procurement: "Procura", it: "TI" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas",
}).format(new Date(value)) : "—";

export default async function MiTrabajoPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;

  const [active, archived] = await Promise.all([
    access.supabase.from("work_items")
      .select("id, code, type, title, status, priority, due_date, closed_at, archived_at")
      .eq("organization_id", access.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    access.supabase.from("work_items")
      .select("id, code, type, title, status, priority, due_date, closed_at, archived_at")
      .eq("organization_id", access.organizationId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(50),
  ]);

  const items = (active.data ?? []) as ListedWorkItem[];
  const archivedItems = (archived.data ?? []) as ListedWorkItem[];
  const allIds = [...items, ...archivedItems].map((item) => item.id);
  const history = allIds.length ? await access.supabase.from("activity_log")
    .select("id, work_item_id, action, before_values, after_values, actor_id, occurred_at")
    .eq("organization_id", access.organizationId)
    .in("work_item_id", allIds)
    .order("occurred_at", { ascending: false })
    .limit(1000) : { data: [], error: null };
  const eventsByItem = new Map<string, ListedHistoryEvent[]>();
  for (const event of (history.data ?? []) as ListedHistoryEvent[]) {
    const events = eventsByItem.get(event.work_item_id) ?? [];
    events.push(event);
    eventsByItem.set(event.work_item_id, events);
  }

  return <div className="page-content"><div className="page-heading"><span className="eyebrow">ORGANIZA TU DÍA</span><h1>Mi trabajo</h1><p>Crea y actualiza tus actividades desde un solo lugar.</p></div>
    <CreateWorkItemForm />
    <section className="work-card work-list"><h2>Actividades recientes</h2>
      {active.error ? <p className="error-message">No se pudo cargar la lista de actividades.</p> : items.length === 0 ? <p className="work-empty">Aún no hay actividades registradas.</p> : <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Área</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Cierre</th><th>Acción</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td>{areaLabels[item.type] ?? item.type}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{priorityLabels[item.priority] ?? item.priority}</td><td>{item.due_date ?? "—"}</td><td>{dateTime(item.closed_at)}</td><td className="work-actions"><details><summary>Editar</summary><EditWorkItemForm item={item} /></details><ArchiveWorkItemForm id={item.id} archived={false} /><WorkItemHistory id={item.id} events={eventsByItem.get(item.id) ?? []} error={Boolean(history.error)} actorId={access.user.id} archived={false} /></td></tr>)}</tbody></table></div>}
    </section>
    <section className="work-card work-list"><h2>Archivo</h2>
      {archived.error ? <p className="error-message">No se pudo cargar el archivo.</p> : archivedItems.length === 0 ? <p className="work-empty">No hay actividades archivadas.</p> : <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Estado</th><th>Archivada</th><th>Acción</th></tr></thead><tbody>{archivedItems.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{dateTime(item.archived_at)}</td><td className="work-actions"><ArchiveWorkItemForm id={item.id} archived /><WorkItemHistory id={item.id} events={eventsByItem.get(item.id) ?? []} error={Boolean(history.error)} actorId={access.user.id} archived /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
