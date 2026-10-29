import Link from "next/link";
import { getAccessContext } from "@/features/auth/access";
import { parsePageNumber, formatWorkItemDateTime } from "@/features/work-items/presentation";
import { CreateVendorForm, EditVendorForm } from "@/components/vendor-forms";
import type { VendorRow } from "@/features/procurement/vendor-rules";

const PAGE_SIZE = 50;

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const page = parsePageNumber((await searchParams).pagina);
  const [vendors, profile] = await Promise.all([
    access.supabase.from("vendors")
      .select("id, name, contact_name, email, phone, notes, created_by, created_at, updated_at")
      .eq("organization_id", access.organizationId).order("name").order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    access.supabase.from("user_profiles").select("timezone").eq("user_id", access.user.id).maybeSingle(),
  ]);
  const rows = (vendors.data ?? []) as VendorRow[];
  const timezone = profile.data?.timezone ?? "America/Caracas";

  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">PROCURA</span><h1>Procura</h1><p>Registra proveedores y mantén sus datos de contacto al día.</p></div>
    <CreateVendorForm />
    <section className="work-card work-list"><h2>Proveedores</h2>
      {vendors.error ? <p role="alert" className="error-message">No se pudieron cargar los proveedores.</p> : rows.length === 0 ?
        <p className="work-empty">{page > 1 ? "No hay más proveedores en esta página." : "Aún no hay proveedores registrados."}</p> :
        <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Contacto</th><th>Correo</th><th>Teléfono</th><th>Observaciones</th><th>Creado</th><th>Actualizado</th><th>Acción</th></tr></thead><tbody>
          {rows.slice(0, PAGE_SIZE).map((vendor) => <tr key={vendor.id}>
            <td><strong>{vendor.name}</strong></td><td>{vendor.contact_name ?? "—"}</td><td>{vendor.email ?? "—"}</td><td>{vendor.phone ?? "—"}</td><td className="vendor-notes">{vendor.notes ?? "—"}</td>
            <td>{formatWorkItemDateTime(vendor.created_at, timezone)}</td><td>{formatWorkItemDateTime(vendor.updated_at, timezone)}</td>
            <td className="work-actions">{vendor.created_by === access.user.id && <details><summary>Editar proveedor</summary><EditVendorForm vendor={vendor} /></details>}</td>
          </tr>)}
        </tbody></table></div>}
      {!vendors.error && (page > 1 || rows.length > PAGE_SIZE) && <nav className="pagination" aria-label="Páginas de proveedores">
        {page > 1 && <Link href={`/procura?pagina=${page - 1}`}>← Anterior</Link>}<span>Página {page}</span>
        {rows.length > PAGE_SIZE && <Link href={`/procura?pagina=${page + 1}`}>Siguiente →</Link>}
      </nav>}
    </section>
  </div>;
}
