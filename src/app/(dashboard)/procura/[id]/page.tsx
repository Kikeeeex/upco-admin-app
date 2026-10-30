import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseWorkItemId } from "@/features/work-items/rules";
import { formatWorkItemDateTime } from "@/features/work-items/presentation";
import type { ProcurementDetail } from "@/features/procurement/request-rules";
import { ArchiveWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

type RequestItem = ListedWorkItem & { created_at: string; updated_at: string };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

export default async function ProcurementRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") notFound();
  let id: string;
  try { id = parseWorkItemId((await params).id); }
  catch { notFound(); }

  const [itemResult, detailResult, sitesResult, profileResult] = await Promise.all([
    access.supabase.from("work_items").select("id, code, type, title, description, site_id, status, priority, due_date, closed_at, archived_at, creator_id, created_at, updated_at")
      .eq("id", id).eq("organization_id", access.organizationId).eq("type", "procurement").maybeSingle(),
    access.supabase.from("procurement_details").select("work_item_id, quantity, unit, need, reference, vendor_id, vendor_name")
      .eq("work_item_id", id).maybeSingle(),
    access.supabase.from("sites").select("id, code, name").eq("organization_id", access.organizationId).order("name"),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
  ]);
  if (itemResult.error || detailResult.error || !itemResult.data || !detailResult.data) notFound();
  const item = itemResult.data as RequestItem;
  const detail = detailResult.data as ProcurementDetail;
  const sites = sitesResult.data ?? [];
  const site = sites.find((entry) => entry.id === item.site_id);
  const timezone = profileResult.data?.timezone ?? "America/Caracas";
  const canEdit = item.creator_id === access.user.id && !item.archived_at;

  return <div className="page-content">
    <div className="page-heading"><Link className="text-link" href="/procura">← Procura</Link><span className="eyebrow">{item.code}</span><h1>{item.title}</h1><p>Ficha de solicitud de procura</p></div>
    <section className="work-card detail-card"><h2>Solicitud</h2><dl className="detail-grid">
      <div><dt>Cantidad</dt><dd>{Number(detail.quantity).toLocaleString("es-VE", { maximumFractionDigits: 3 })} {detail.unit}</dd></div>
      <div><dt>Sede de destino</dt><dd>{site ? `${site.code} · ${site.name}` : "Sede no disponible"}</dd></div>
      <div><dt>Proveedor</dt><dd>{detail.vendor_name ?? "Por definir"}{detail.vendor_name && !detail.vendor_id ? " (eliminado del catálogo)" : ""}</dd></div>
      <div><dt>Referencia</dt><dd>{detail.reference ?? "—"}</dd></div>
      <div><dt>Estado</dt><dd>{statusLabels[item.status] ?? item.status}</dd></div>
      <div><dt>Creada</dt><dd>{formatWorkItemDateTime(item.created_at, timezone)}</dd></div>
      <div><dt>Actualizada</dt><dd>{formatWorkItemDateTime(item.updated_at, timezone)}</dd></div>
    </dl><h3>Necesidad</h3><p className="detail-description">{detail.need}</p>
      <div className="detail-actions"><Link className="text-link" href={`/mi-trabajo/${id}`}>Ver historial, notas y archivo</Link>
        {canEdit && <><h3>Editar estado de trabajo</h3><EditWorkItemForm item={item} sites={sites} /><ArchiveWorkItemForm id={id} archived={false} /></>}
        {item.archived_at && item.creator_id === access.user.id && <ArchiveWorkItemForm id={id} archived />}
      </div>
    </section>
  </div>;
}
