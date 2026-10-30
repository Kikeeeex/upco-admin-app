import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { parseWorkItemId } from "@/features/work-items/rules";
import { formatWorkItemDateTime } from "@/features/work-items/presentation";
import type { ProcurementDetail, ProcurementLineItem } from "@/features/procurement/request-rules";
import { vendorAreaLabels } from "@/features/procurement/vendor-rules";
import { EditProcurementRequesterForm } from "@/components/procurement-request-form";
import { ArchiveWorkItemForm, EditWorkItemForm, type ListedWorkItem } from "@/components/work-item-forms";

type RequestItem = ListedWorkItem & { created_at: string; updated_at: string };
const statusLabels: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", waiting: "En espera", completed: "Completada", cancelled: "Cancelada" };

export default async function ProcurementRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") notFound();
  let id: string;
  try { id = parseWorkItemId((await params).id); }
  catch { notFound(); }

  const [itemResult, detailResult, linesResult, sitesResult, profileResult] = await Promise.all([
    access.supabase.from("work_items").select("id, code, type, title, description, site_id, status, priority, due_date, closed_at, archived_at, creator_id, created_at, updated_at")
      .eq("id", id).eq("organization_id", access.organizationId).eq("type", "procurement").maybeSingle(),
    access.supabase.from("procurement_details").select("work_item_id, quantity, unit, need, reference, vendor_id, vendor_name, part_number, requester_first_name, requester_last_name, requester_area, item_count")
      .eq("work_item_id", id).maybeSingle(),
    access.supabase.from("procurement_request_items").select("id, work_item_id, position, article, part_number, quantity, unit")
      .eq("work_item_id", id).order("position"),
    access.supabase.from("sites").select("id, code, name").eq("organization_id", access.organizationId).order("name"),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
  ]);
  if (itemResult.error || detailResult.error || !itemResult.data || !detailResult.data) notFound();
  const item = itemResult.data as RequestItem;
  const detail = detailResult.data as ProcurementDetail;
  const lines = (linesResult.data ?? []) as ProcurementLineItem[];
  const sites = sitesResult.data ?? [];
  const site = sites.find((entry) => entry.id === item.site_id);
  const timezone = profileResult.data?.timezone ?? "America/Caracas";
  const canEdit = item.creator_id === access.user.id && !item.archived_at;

  return <div className="page-content">
    <div className="page-heading"><Link className="text-link" href="/procura">← Procura</Link><span className="eyebrow">{item.code}</span><h1>{item.title}</h1><p>Ficha de solicitud de procura</p></div>
    <section className="work-card detail-card"><h2>Solicitud</h2><dl className="detail-grid">
      <div><dt>Artículos</dt><dd>{detail.item_count} {detail.item_count === 1 ? "artículo" : "artículos"}</dd></div>
      <div><dt>Sede de destino</dt><dd>{site ? `${site.code} · ${site.name}` : "Sede no disponible"}</dd></div>
      <div><dt>Proveedor</dt><dd>{detail.vendor_name ?? "Por definir"}{detail.vendor_name && !detail.vendor_id ? " (eliminado del catálogo)" : ""}</dd></div>
      <div><dt>Solicitante</dt><dd>{[detail.requester_first_name, detail.requester_last_name].filter(Boolean).join(" ") || "No registrado"}</dd></div>
      <div><dt>Área solicitante</dt><dd>{detail.requester_area ? vendorAreaLabels[detail.requester_area] : "No registrada"}</dd></div>
      <div><dt>Referencia</dt><dd>{detail.reference ?? "—"}</dd></div>
      <div><dt>Estado</dt><dd>{statusLabels[item.status] ?? item.status}</dd></div>
      <div><dt>Creada</dt><dd>{formatWorkItemDateTime(item.created_at, timezone)}</dd></div>
      <div><dt>Actualizada</dt><dd>{formatWorkItemDateTime(item.updated_at, timezone)}</dd></div>
    </dl><h3>Necesidad</h3><p className="detail-description">{detail.need}</p>
      <div className="detail-actions"><Link className="text-link" href={`/mi-trabajo/${id}`}>Ver historial, notas y archivo</Link>
        {canEdit && <><h3>Editar solicitante y número de parte</h3><EditProcurementRequesterForm detail={detail} /><h3>Editar estado de trabajo</h3><EditWorkItemForm item={item} sites={sites} /><ArchiveWorkItemForm id={id} archived={false} /></>}
        {item.archived_at && item.creator_id === access.user.id && <ArchiveWorkItemForm id={id} archived />}
      </div>
    </section>
    <section className="work-card work-list"><h2>Artículos solicitados</h2>
      {linesResult.error ? <p role="alert" className="error-message">No se pudieron cargar los artículos.</p> :
        <div className="table-scroll"><table><thead><tr><th>N.º</th><th>Artículo o servicio</th><th>Número de parte</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>
          {lines.map((line) => <tr key={line.id}><td>{line.position}</td><td>{line.article}</td><td>{line.part_number ?? "—"}</td><td>{Number(line.quantity).toLocaleString("es-VE", { maximumFractionDigits: 3 })}</td><td>{line.unit}</td></tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}
