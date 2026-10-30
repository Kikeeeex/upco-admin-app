import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { parsePageNumber, formatWorkItemDateTime } from "@/features/work-items/presentation";
import { CreateVendorForm, EditVendorForm, VendorArchiveForm } from "@/components/vendor-forms";
import { vendorAreaLabel, type VendorRow } from "@/features/procurement/vendor-rules";

const PAGE_SIZE = 50;

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[]; archivoPagina?: string | string[] }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const params = await searchParams;
  const page = parsePageNumber(params.pagina);
  const archivePage = parsePageNumber(params.archivoPagina);
  const [vendors, archivedVendors, profile] = await Promise.all([
    access.supabase.from("vendors")
      .select("id, name, associated_area, contact_name, email, phone, notes, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", access.organizationId).is("archived_at", null).order("name").order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    access.supabase.from("vendors")
      .select("id, name, associated_area, contact_name, email, phone, notes, archived_at, created_by, created_at, updated_at")
      .eq("organization_id", access.organizationId).not("archived_at", "is", null)
      .order("archived_at", { ascending: false }).order("id")
      .range((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
  ]);
  const rows = (vendors.data ?? []) as VendorRow[];
  const archivedRows = (archivedVendors.data ?? []) as VendorRow[];
  const timezone = profile.data?.timezone ?? "America/Caracas";

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">PROCURA</span><h1>Procura</h1><p>Registra proveedores y mantén sus datos de contacto al día.</p></div>
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
              <details className="vendor-delete"><summary>Eliminar proveedor</summary><p>Se retirará del catálogo activo. Podrás restaurarlo desde abajo.</p><VendorArchiveForm vendor={vendor} /></details>
            </>}</td>
          </tr>)}
        </tbody></table></div>}
      {!vendors.error && (page > 1 || rows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de proveedores">
        {page > 1 && <Link href={`/procura?pagina=${page - 1}${archivePage > 1 ? `&archivoPagina=${archivePage}` : ""}`}>← Anterior</Link>}<span>Página {page}</span>
        {rows.length > PAGE_SIZE && <Link href={`/procura?pagina=${page + 1}${archivePage > 1 ? `&archivoPagina=${archivePage}` : ""}`}>Siguiente →</Link>}
      </nav>}
    </section>
    <section className="work-card work-list"><h2>Proveedores eliminados</h2>
      {archivedVendors.error ? <p role="alert" className="error-message">No se pudieron cargar los proveedores eliminados.</p> : archivedRows.length === 0 ?
        <p className="work-empty">{archivePage > 1 ? "No hay más proveedores eliminados en esta página." : "No hay proveedores eliminados."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Área asociada</th><th>Eliminado</th><th>Acción</th></tr></thead><tbody>
          {archivedRows.slice(0, PAGE_SIZE).map((vendor) => <tr key={vendor.id}>
            <td><strong>{vendor.name}</strong></td><td>{vendorAreaLabel(vendor.associated_area)}</td>
            <td>{vendor.archived_at ? formatWorkItemDateTime(vendor.archived_at, timezone) : "—"}</td>
            <td>{vendor.created_by === access.user.id && <VendorArchiveForm vendor={vendor} restoring />}</td>
          </tr>)}
        </tbody></table></div>}
      {!archivedVendors.error && (archivePage > 1 || archivedRows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de proveedores eliminados">
        {archivePage > 1 && <Link href={`/procura?pagina=${page}&archivoPagina=${archivePage - 1}`}>← Anterior</Link>}<span>Página {archivePage}</span>
        {archivedRows.length > PAGE_SIZE && <Link href={`/procura?pagina=${page}&archivoPagina=${archivePage + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
  </div>;
}
