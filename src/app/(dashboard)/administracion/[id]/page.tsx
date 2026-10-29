import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseWorkItemId } from "@/features/work-items/rules";
import { formatWorkItemDateTime } from "@/features/work-items/presentation";
import { EditAdminDetailsForm, type AdminDetail } from "@/components/admin-matter-forms";
import { ArchiveWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

const documentLabels: Record<string, string> = { pending: "Documentación pendiente", received: "Documentación recibida", reviewed: "Documentación revisada" };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

type Matter = ListedWorkItem & { created_at: string; updated_at: string };

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") notFound();

  let id: string;
  try { id = parseWorkItemId((await params).id); }
  catch { notFound(); }

  const [matterResult, detailResult, sitesResult, profileResult] = await Promise.all([
    access.supabase.from("work_items").select("id, code, type, title, description, site_id, status, priority, due_date, closed_at, archived_at, creator_id, created_at, updated_at")
      .eq("id", id).eq("organization_id", access.organizationId).eq("type", "administration").maybeSingle(),
    access.supabase.from("admin_details").select("work_item_id, procedure_type, counterpart_name, reference, document_status, document_reference, document_url")
      .eq("work_item_id", id).maybeSingle(),
    access.supabase.from("sites").select("id, code, name").eq("organization_id", access.organizationId).order("name"),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
  ]);
  if (matterResult.error || detailResult.error || !matterResult.data || !detailResult.data) notFound();
  const matter = matterResult.data as Matter;
  const details = detailResult.data as AdminDetail;
  const sites = sitesResult.data ?? [];
  const selectedSite = sites.find((site) => site.id === matter.site_id);
  const timezone = profileResult.data?.timezone ?? "America/Caracas";
  const canEdit = matter.creator_id === access.user.id && !matter.archived_at;
  const documentUrl = details.document_url && /^https?:\/\//i.test(details.document_url) ? details.document_url : null;

  return <div className="page-content">
    <div className="page-heading"><Link className="text-link" href="/administracion">← Administración</Link><span className="eyebrow">{matter.code}</span><h1>{matter.title}</h1><p>Ficha de gestión administrativa</p></div>
    <section className="work-card detail-card"><h2>Gestión y documentación</h2><dl className="detail-grid">
      <div><dt>Tipo de gestión</dt><dd>{details.procedure_type}</dd></div>
      <div><dt>Contraparte</dt><dd>{details.counterpart_name}</dd></div>
      <div><dt>Referencia de gestión</dt><dd>{details.reference ?? "—"}</dd></div>
      <div><dt>Estado</dt><dd>{statusLabels[matter.status] ?? matter.status}</dd></div>
      <div><dt>Documentación</dt><dd><span className="badge">{documentLabels[details.document_status] ?? details.document_status}</span></dd></div>
      <div><dt>Referencia documental</dt><dd>{details.document_reference ?? "—"}</dd></div>
      <div><dt>Enlace del documento</dt><dd>{documentUrl ? <a className="text-link" href={documentUrl} target="_blank" rel="noopener noreferrer">Abrir documento</a> : "Sin enlace"}</dd></div>
      <div><dt>Fecha de compromiso</dt><dd>{matter.due_date ?? "—"}</dd></div>
      <div><dt>Sede</dt><dd>{matter.site_id ? selectedSite ? `${selectedSite.code} · ${selectedSite.name}` : "Sede no disponible" : "Sin sede"}</dd></div>
      <div><dt>Creada</dt><dd>{formatWorkItemDateTime(matter.created_at, timezone)}</dd></div>
      <div><dt>Actualizada</dt><dd>{formatWorkItemDateTime(matter.updated_at, timezone)}</dd></div>
    </dl>
      {matter.description && <p className="detail-description">{matter.description}</p>}
      <div className="detail-actions"><Link className="text-link" href={`/mi-trabajo/${id}`}>Ver historial, notas y archivo</Link>
        {canEdit && <><h3>Editar gestión</h3><EditWorkItemForm item={matter} sites={sites} dueLabel="Fecha de compromiso" /><h3>Editar documentación</h3><EditAdminDetailsForm details={details} /><ArchiveWorkItemForm id={id} archived={false} /></>}
        {matter.archived_at && matter.creator_id === access.user.id && <ArchiveWorkItemForm id={id} archived />}
      </div>
    </section>
  </div>;
}
