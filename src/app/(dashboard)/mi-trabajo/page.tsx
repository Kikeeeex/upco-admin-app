import { getAccessContext } from "@/features/auth/access";
import { CreateWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

const areaLabels: Record<string, string> = { general: "General", administration: "Administración", procurement: "Procura", it: "TI" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

export default async function MiTrabajoPage() {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;

  const { data, error } = await access.supabase.from("work_items")
    .select("id, code, type, title, status, priority, due_date")
    .eq("organization_id", access.organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (data ?? []) as ListedWorkItem[];
  return <div className="page-content"><div className="page-heading"><span className="eyebrow">ORGANIZA TU DÍA</span><h1>Mi trabajo</h1><p>Crea y actualiza tus actividades desde un solo lugar.</p></div>
    <CreateWorkItemForm />
    <section className="work-card work-list"><h2>Actividades recientes</h2>
      {error ? <p className="error-message">No se pudo cargar la lista de actividades.</p> : items.length === 0 ? <p className="work-empty">Aún no hay actividades registradas.</p> : <div className="table-scroll"><table><thead><tr><th>Código</th><th>Actividad</th><th>Área</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Acción</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td>{areaLabels[item.type] ?? item.type}</td><td><span className="badge">{statusLabels[item.status] ?? item.status}</span></td><td>{priorityLabels[item.priority] ?? item.priority}</td><td>{item.due_date ?? "—"}</td><td><details><summary>Editar</summary><EditWorkItemForm item={item} /></details></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
