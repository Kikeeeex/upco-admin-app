import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { parsePageNumber, formatWorkItemDateTime } from "@/features/work-items/presentation";
import { CreateVendorForm, EditVendorForm, VendorArchiveForm, VendorPermanentDeleteForm } from "@/components/vendor-forms";
import { vendorAreaLabel, vendorArchiveCutoff, vendorArchiveExpiry, type VendorRow } from "@/features/procurement/vendor-rules";
import { CreateProcurementRequestForm } from "@/components/procurement-request-form";
import type { ProcurementDetail } from "@/features/procurement/request-rules";

const PAGE_SIZE = 50;

type RequestRow = { id: string; code: string; title: string; site_id: string | null; status: string; created_at: string };

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[]; archivoPagina?: string | string[]; solicitudesPagina?: string | string[] }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const params = await searchParams;
  const page = parsePageNumber(params.pagina);
  const archivePage = parsePageNumber(params.archivoPagina);
  const requestPage = parsePageNumber(params.solicitudesPagina);
  const [vendors, archivedVendors, profile, requests, sites, vendorOptions] = await Promise.all([
    access.supabase.from("vendors")
      .select("id, name, associated_area, contact_name, email, phone, notes, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", access.organizationId).is("archived_at", null).order("name").order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    access.supabase.from("vendors")
      .select("id, name, associated_area, contact_name, email, phone, notes, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", access.organizationId).not("archived_at", "is", null).gte("archived_at", vendorArchiveCutoff())
      .order("archived_at", { ascending: false }).order("id")
      .range((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
    access.supabase.from("work_items").select("id, code, title, site_id, status, created_at")
      .eq("organization_id", access.organizationId).eq("type", "procurement").is("archived_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((requestPage - 1) * PAGE_SIZE, requestPage * PAGE_SIZE),
    access.supabase.from("sites").select("id, code, name").eq("organization_id", access.organizationId).order("name"),
    (async () => {
      const all: { id: string; name: string }[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await access.supabase.from("vendors").select("id, name")
          .eq("organization_id", access.organizationId).is("archived_at", null)
          .order("name").order("id").range(offset, offset + 499);
        if (result.error) return { data: null, error: result.error };
        all.push(...(result.data ?? []));
        if ((result.data ?? []).length < 500) return { data: all, error: null };
      }
    })(),
  ]);
  const rows = (vendors.data ?? []) as VendorRow[];
  const archivedRows = (archivedVendors.data ?? []) as VendorRow[];
  const requestRows = (requests.data ?? []) as RequestRow[];
  const requestDetailsResult = requestRows.length ? await access.supabase.from("procurement_details")
    .select("work_item_id, quantity, unit, need, reference, vendor_id, vendor_name, part_number, requester_first_name, requester_last_name, requester_area, item_count")
    .in("work_item_id", requestRows.map((item) => item.id)) : { data: [] as ProcurementDetail[], error: null };
  const requestDetails = new Map(((requestDetailsResult.data ?? []) as ProcurementDetail[]).map((detail) => [detail.work_item_id, detail]));
  const siteLabels = new Map((sites.data ?? []).map((site) => [site.id, `${site.code} · ${site.name}`]));
  const timezone = profile.data?.timezone ?? "America/Caracas";

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">PROCURA</span><h1>Procura</h1><p>Registra solicitudes y proveedores para organizar tus compras.</p></div>
    {sites.error && <p role="alert" className="error-message">No se pudieron cargar las sedes.</p>}
    {vendorOptions.error && <p role="alert" className="error-message">No se pudieron cargar los proveedores para la solicitud.</p>}
    <CreateProcurementRequestForm sites={sites.data ?? []} vendors={vendorOptions.data ?? []} />
    <section className="work-card work-list"><h2>Solicitudes activas</h2>
      {requests.error || requestDetailsResult.error ? <p role="alert" className="error-message">No se pudieron cargar las solicitudes.</p> : requestRows.length === 0 ?
        <p className="work-empty">{requestPage > 1 ? "No hay más solicitudes en esta página." : "Aún no hay solicitudes registradas."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Primer artículo o servicio</th><th>Artículos</th><th>Número de parte</th><th>Cantidad</th><th>Sede de destino</th><th>Solicitante</th><th>Proveedor</th><th>Estado</th><th>Ficha</th></tr></thead><tbody>
          {requestRows.slice(0, PAGE_SIZE).map((item) => { const detail = requestDetails.get(item.id); return <tr key={item.id}>
            <td>{item.code}</td><td>{item.title}</td><td>{detail ? `${detail.item_count} ${detail.item_count === 1 ? "artículo" : "artículos"}` : "—"}</td><td>{detail?.part_number ?? "—"}</td><td>{detail ? `${Number(detail.quantity).toLocaleString("es-VE", { maximumFractionDigits: 3 })} ${detail.unit}` : "—"}</td>
            <td>{item.site_id ? siteLabels.get(item.site_id) ?? "Sede no disponible" : "—"}</td><td>{[detail?.requester_first_name, detail?.requester_last_name].filter(Boolean).join(" ") || "No registrado"}</td><td>{detail?.vendor_name ?? "Por definir"}</td><td>{item.status === "pending" ? "Pendiente" : item.status}</td>
            <td><Link className="text-link" href={`/procura/${item.id}`}>Ver ficha</Link></td>
          </tr>; })}
        </tbody></table></div>}
      {!requests.error && (requestPage > 1 || requestRows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de solicitudes">
        {requestPage > 1 && <Link href={`/procura?solicitudesPagina=${requestPage - 1}`}>← Anterior</Link>}<span>Página {requestPage}</span>
        {requestRows.length > PAGE_SIZE && <Link href={`/procura?solicitudesPagina=${requestPage + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
    <CreateVendorForm />
    <section className="work-card work-list"><h2>Proveedores</h2>
      {vendors.error ? <p role="alert" className="error-message">No se pudieron cargar los proveedores.</p> : rows.length === 0 ?
        <p className="work-empty">{page > 1 ? "No hay más proveedores en esta página." : "Aún no hay proveedores registrados."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Área asociada</th><th>Contacto</th><th>Correo</th><th>Teléfono</th><th>Observaciones</th><th>Creado</th><th>Actualizado</th><th>Acción</th></tr></thead><tbody>
          {rows.slice(0, PAGE_SIZE).map((vendor) => <tr key={vendor.id}>
            <td><strong>{vendor.name}</strong></td><td>{vendorAreaLabel(vendor.associated_area)}</td><td>{vendor.contact_name ?? "—"}</td><td>{vendor.email ?? "—"}</td><td>{vendor.phone ?? "—"}</td><td className="vendor-notes">{vendor.notes ?? "—"}</td>
            <td>{formatWorkItemDateTime(vendor.created_at, timezone)}</td><td>{formatWorkItemDateTime(vendor.updated_at, timezone)}</td>
            <td className="work-actions">{vendor.created_by === access.user.id && <>
              <details><summary>Editar proveedor</summary><EditVendorForm vendor={vendor} /></details>
              <details className="vendor-delete"><summary>Eliminar proveedor</summary><p>Se retirará del catálogo activo. Podrás restaurarlo durante 30 días desde abajo.</p><VendorArchiveForm vendor={vendor} /></details>
            </>}</td>
          </tr>)}
        </tbody></table></div>}
      {!vendors.error && (page > 1 || rows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de proveedores">
        {page > 1 && <Link href={`/procura?pagina=${page - 1}${archivePage > 1 ? `&archivoPagina=${archivePage}` : ""}`}>← Anterior</Link>}<span>Página {page}</span>
        {rows.length > PAGE_SIZE && <Link href={`/procura?pagina=${page + 1}${archivePage > 1 ? `&archivoPagina=${archivePage}` : ""}`}>Siguiente →</Link>}
      </nav>}
    </section>
    <section className="work-card work-list"><h2>Proveedores eliminados</h2><p className="vendor-retention-note">Puedes restaurarlos durante 30 días. Después se eliminan permanentemente.</p>
      {archivedVendors.error ? <p role="alert" className="error-message">No se pudieron cargar los proveedores eliminados.</p> : archivedRows.length === 0 ?
        <p className="work-empty">{archivePage > 1 ? "No hay más proveedores eliminados en esta página." : "No hay proveedores eliminados."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Área asociada</th><th>Eliminado</th><th>Eliminación definitiva</th><th>Acción</th></tr></thead><tbody>
          {archivedRows.slice(0, PAGE_SIZE).map((vendor) => <tr key={vendor.id}>
            <td><strong>{vendor.name}</strong></td><td>{vendorAreaLabel(vendor.associated_area)}</td>
            <td>{vendor.archived_at ? formatWorkItemDateTime(vendor.archived_at, timezone) : "—"}</td>
            <td>{vendor.archived_at ? `Se eliminará permanentemente a partir del ${formatWorkItemDateTime(vendorArchiveExpiry(vendor.archived_at), timezone)}` : "—"}</td>
            <td className="work-actions">{vendor.created_by === access.user.id && <><VendorArchiveForm vendor={vendor} restoring /><VendorPermanentDeleteForm vendor={vendor} /></>}</td>
          </tr>)}
        </tbody></table></div>}
      {!archivedVendors.error && (archivePage > 1 || archivedRows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de proveedores eliminados">
        {archivePage > 1 && <Link href={`/procura?pagina=${page}&archivoPagina=${archivePage - 1}`}>← Anterior</Link>}<span>Página {archivePage}</span>
        {archivedRows.length > PAGE_SIZE && <Link href={`/procura?pagina=${page}&archivoPagina=${archivePage + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
  </div>;
}
