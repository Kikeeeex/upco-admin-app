import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { parsePageNumber } from "@/features/work-items/presentation";
import { CreateAdminMatterForm } from "@/components/admin-matter-forms";

const PAGE_SIZE = 50;
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };
const documentLabels: Record<string, string> = { pending: "Pendiente", received: "Recibida", reviewed: "Revisada" };

type AdminListRow = {
  id: string; code: string; title: string; status: string; due_date: string | null;
};
type AdminListDetail = { work_item_id: string; procedure_type: string; counterpart_name: string; document_status: string };

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;

  const page = parsePageNumber((await searchParams).pagina);
  const [matters, sites] = await Promise.all([
    access.supabase.from("work_items")
      .select("id, code, title, status, due_date")
      .eq("organization_id", access.organizationId).eq("type", "administration").is("archived_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    access.supabase.from("sites").select("id, code, name")
      .eq("organization_id", access.organizationId).order("name"),
  ]);
  const rows = (matters.data ?? []) as AdminListRow[];
  const detailsResult = rows.length ? await access.supabase.from("admin_details")
    .select("work_item_id, procedure_type, counterpart_name, document_status")
    .in("work_item_id", rows.map((item) => item.id)) : { data: [] as AdminListDetail[], error: null };
  const details = new Map(((detailsResult.data ?? []) as AdminListDetail[]).map((detail) => [detail.work_item_id, detail]));
  const items = rows.slice(0, PAGE_SIZE).filter((item) => details.has(item.id));
  const loadError = matters.error || detailsResult.error;

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">GESTIONES</span><h1>Administración</h1><p>Registra trámites, compromisos y el estado de sus documentos.</p></div>
    {sites.error && <p role="alert" className="error-message">No se pudieron cargar las sedes. Puedes crear una gestión sin sede.</p>}
    <CreateAdminMatterForm sites={sites.data ?? []} />
    <section className="work-card work-list"><h2>Gestiones activas</h2>
      {loadError ? <p role="alert" className="error-message">No se pudieron cargar las gestiones.</p> : items.length === 0 ?
        <p className="work-empty">{page > 1 ? "No hay más gestiones en esta página." : "Aún no hay gestiones administrativas."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Asunto</th><th>Tipo</th><th>Contraparte</th><th>Estado</th><th>Documentación</th><th>Compromiso</th><th>Ficha</th></tr></thead><tbody>
          {items.map((item) => { const detail = details.get(item.id)!; return <tr key={item.id}><td>{item.code}</td><td>{item.title}</td><td>{detail.procedure_type}</td><td>{detail.counterpart_name}</td><td>{statusLabels[item.status] ?? item.status}</td><td><span className="badge">{documentLabels[detail.document_status] ?? detail.document_status}</span></td><td>{item.due_date ?? "—"}</td><td><Link className="text-link" href={`/administracion/${item.id}`}>Ver ficha</Link></td></tr>; })}
        </tbody></table></div>}
      {!loadError && (page > 1 || rows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de gestiones">
        {page > 1 && <Link href={`/administracion?pagina=${page - 1}`}>← Anterior</Link>}<span>Página {page}</span>
        {rows.length > PAGE_SIZE && <Link href={`/administracion?pagina=${page + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
  </div>;
}
