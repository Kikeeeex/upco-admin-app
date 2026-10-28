import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { escapeLikePattern, localDateInTimezone, parseWorkItemFilters, workItemListHref, type RawWorkItemFilters } from "@/features/work-items/filters";
import { parsePageNumber, formatWorkItemDateTime } from "@/features/work-items/presentation";
import { ArchiveWorkItemForm, CreateWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

const PAGE_SIZE = 50;
const areaLabels: Record<string, string> = { general: "General", administration: "Administración", procurement: "Procura", it: "TI" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

type Search = RawWorkItemFilters & { activos?: string | string[]; archivo?: string | string[] };

function Pagination({ page, hasNext, label, href }: {
  page: number; hasNext: boolean; label: string; href: (page: number) => string;
}) {
  if (page === 1 && !hasNext) return null;
  return <nav className="pagination" aria-label={`Páginas de ${label}`}>
    {page > 1 && <Link href={href(page - 1)}>← Anterior</Link>}
    <span>Página {page}</span>
    {hasNext && <Link href={href(page + 1)}>Siguiente →</Link>}
  </nav>;
}

export default async function MiTrabajoPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const supabase = access.supabase;
  const search = await searchParams;
  const filters = parseWorkItemFilters(search);
  const activePage = parsePageNumber(search.activos);
  const archivePage = parsePageNumber(search.archivo);
  const [profile, sites] = await Promise.all([
    supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
    supabase.from("sites").select("id, code, name").eq("organization_id", access.organizationId).order("name"),
  ]);

  const timezone = profile.data?.timezone ?? "America/Caracas";
  const today = localDateInTimezone(new Date(), timezone);
  function listQuery(isArchived: boolean, page: number) {
    let query = supabase.from("work_items")
      .select("id, code, type, title, status, priority, due_date, closed_at, archived_at, creator_id")
      .eq("organization_id", access.organizationId);
    query = isArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    if (filters.query) query = query.ilike("search_text", `%${escapeLikePattern(filters.query)}%`);
    if (filters.area) query = query.eq("type", filters.area);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.site) query = query.eq("site_id", filters.site);
    if (filters.due === "overdue") query = query.lt("due_date", today).in("status", ["pending", "in_progress", "waiting"]);
    if (filters.due === "today") query = query.eq("due_date", today);
    if (filters.due === "upcoming") query = query.gt("due_date", today);
    if (filters.due === "none") query = query.is("due_date", null);
    return query.order(isArchived ? "archived_at" : "created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }
  const [active, archived] = await Promise.all([listQuery(false, activePage), listQuery(true, archivePage)]);
  const activeRows = (active.data ?? []) as ListedWorkItem[];
  const archivedRows = (archived.data ?? []) as ListedWorkItem[];
  const items = activeRows.slice(0, PAGE_SIZE);
  const archivedItems = archivedRows.slice(0, PAGE_SIZE);
  const activeHref = (page: number) => workItemListHref(filters, page, archivePage);
  const archiveHref = (page: number) => workItemListHref(filters, activePage, page);
  const hasFilters = Object.values(filters).some(Boolean);

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ORGANIZA TU DÍA</span><h1>Mi trabajo</h1><p>Crea y actualiza tus actividades desde un solo lugar.</p></div>
    <CreateWorkItemForm />
    <section className="work-card work-filters"><h2>Buscar y filtrar</h2>
      <form action="/mi-trabajo" method="get" className="filter-grid" role="search">
        <div className="field filter-search"><label htmlFor="filter-q">Código o título</label><input id="filter-q" name="q" type="search" maxLength={100} defaultValue={filters.query} placeholder="Buscar actividad" /></div>
        <div className="field"><label htmlFor="filter-area">Área</label><select id="filter-area" name="area" defaultValue={filters.area}><option value="">Todas</option>{Object.entries(areaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="filter-status">Estado</label><select id="filter-status" name="status" defaultValue={filters.status}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="filter-site">Sede</label><select id="filter-site" name="site" defaultValue={filters.site}><option value="">Todas</option>{(sites.data ?? []).map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}{filters.site && !(sites.data ?? []).some((site) => site.id === filters.site) && <option value={filters.site}>Sede no disponible</option>}</select></div>
        <div className="field"><label htmlFor="filter-priority">Prioridad</label><select id="filter-priority" name="priority" defaultValue={filters.priority}><option value="">Todas</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="filter-due">Vencimiento</label><select id="filter-due" name="due" defaultValue={filters.due}><option value="">Cualquiera</option><option value="overdue">Vencidas</option><option value="today">Vencen hoy</option><option value="upcoming">Futuras</option><option value="none">Sin fecha</option></select></div>
        <div className="filter-actions"><button className="quiet-button" type="submit">Aplicar filtros</button><Link href="/mi-trabajo" className="text-link">Limpiar</Link></div>
      </form>
      {sites.error && <p className="error-message">No se pudieron cargar las sedes.</p>}
    </section>
    <section className="work-card work-list"><h2>Actividades recientes</h2>
      {active.error ? <p className="error-message">No se pudo cargar la lista de actividades.</p> : items.length === 0 ?
        <p className="work-empty">{activePage > 1 ? "No hay más actividades en esta página." : hasFilters ? "No hay actividades que cumplan estos filtros." : "Aún no hay actividades registradas."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Área</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Cierre</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td>{areaLabels[item.type] ?? item.type}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{priorityLabels[item.priority] ?? item.priority}</td><td>{item.due_date ?? "—"}</td><td>{formatWorkItemDateTime(item.closed_at, timezone)}</td><td className="work-actions"><Link href={`/mi-trabajo/${item.id}`}>Ver ficha e historial</Link>{item.creator_id === access.user.id && <><details><summary>Editar</summary><EditWorkItemForm item={item} /></details><ArchiveWorkItemForm id={item.id} archived={false} /></>}</td></tr>)}</tbody></table></div>}
      {!active.error && <Pagination page={activePage} hasNext={activeRows.length > PAGE_SIZE} label="actividades" href={activeHref} />}
    </section>
    <section className="work-card work-list"><h2>Archivo</h2>
      {archived.error ? <p className="error-message">No se pudo cargar el archivo.</p> : archivedItems.length === 0 ?
        <p className="work-empty">{archivePage > 1 ? "No hay más actividades archivadas en esta página." : hasFilters ? "No hay actividades archivadas que cumplan estos filtros." : "No hay actividades archivadas."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Estado</th><th>Archivada</th><th>Acción</th></tr></thead>
          <tbody>{archivedItems.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{formatWorkItemDateTime(item.archived_at, timezone)}</td><td className="work-actions"><Link href={`/mi-trabajo/${item.id}`}>Ver ficha e historial</Link>{item.creator_id === access.user.id && <ArchiveWorkItemForm id={item.id} archived />}</td></tr>)}</tbody></table></div>}
      {!archived.error && <Pagination page={archivePage} hasNext={archivedRows.length > PAGE_SIZE} label="archivo" href={archiveHref} />}
    </section>
  </div>;
}
