import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { parsePageNumber, formatWorkItemDateTime } from "@/features/work-items/presentation";
import { ArchiveWorkItemForm, CreateWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

const PAGE_SIZE = 50;
const areaLabels: Record<string, string> = { general: "General", administration: "Administración", procurement: "Procura", it: "TI" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

type Search = { activos?: string | string[]; archivo?: string | string[] };

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
  const search = await searchParams;
  const activePage = parsePageNumber(search.activos);
  const archivePage = parsePageNumber(search.archivo);
  const [profile, active, archived] = await Promise.all([
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
    access.supabase.from("work_items")
      .select("id, code, type, title, status, priority, due_date, closed_at, archived_at, creator_id")
      .eq("organization_id", access.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE),
    access.supabase.from("work_items")
      .select("id, code, type, title, status, priority, due_date, closed_at, archived_at, creator_id")
      .eq("organization_id", access.organizationId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .order("id", { ascending: false })
      .range((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE),
  ]);

  const timezone = profile.data?.timezone ?? "America/Caracas";
  const activeRows = (active.data ?? []) as ListedWorkItem[];
  const archivedRows = (archived.data ?? []) as ListedWorkItem[];
  const items = activeRows.slice(0, PAGE_SIZE);
  const archivedItems = archivedRows.slice(0, PAGE_SIZE);
  const activeHref = (page: number) => `/mi-trabajo?activos=${page}&archivo=${archivePage}`;
  const archiveHref = (page: number) => `/mi-trabajo?activos=${activePage}&archivo=${page}`;

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ORGANIZA TU DÍA</span><h1>Mi trabajo</h1><p>Crea y actualiza tus actividades desde un solo lugar.</p></div>
    <CreateWorkItemForm />
    <section className="work-card work-list"><h2>Actividades recientes</h2>
      {active.error ? <p className="error-message">No se pudo cargar la lista de actividades.</p> : items.length === 0 ?
        <p className="work-empty">{activePage === 1 ? "Aún no hay actividades registradas." : "No hay más actividades en esta página."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Área</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Cierre</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td>{areaLabels[item.type] ?? item.type}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{priorityLabels[item.priority] ?? item.priority}</td><td>{item.due_date ?? "—"}</td><td>{formatWorkItemDateTime(item.closed_at, timezone)}</td><td className="work-actions"><Link href={`/mi-trabajo/${item.id}`}>Ver ficha e historial</Link>{item.creator_id === access.user.id && <><details><summary>Editar</summary><EditWorkItemForm item={item} /></details><ArchiveWorkItemForm id={item.id} archived={false} /></>}</td></tr>)}</tbody></table></div>}
      {!active.error && <Pagination page={activePage} hasNext={activeRows.length > PAGE_SIZE} label="actividades" href={activeHref} />}
    </section>
    <section className="work-card work-list"><h2>Archivo</h2>
      {archived.error ? <p className="error-message">No se pudo cargar el archivo.</p> : archivedItems.length === 0 ?
        <p className="work-empty">{archivePage === 1 ? "No hay actividades archivadas." : "No hay más actividades archivadas en esta página."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Estado</th><th>Archivada</th><th>Acción</th></tr></thead>
          <tbody>{archivedItems.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{formatWorkItemDateTime(item.archived_at, timezone)}</td><td className="work-actions"><Link href={`/mi-trabajo/${item.id}`}>Ver ficha e historial</Link>{item.creator_id === access.user.id && <ArchiveWorkItemForm id={item.id} archived />}</td></tr>)}</tbody></table></div>}
      {!archived.error && <Pagination page={archivePage} hasNext={archivedRows.length > PAGE_SIZE} label="archivo" href={archiveHref} />}
    </section>
  </div>;
}
