import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContext } from "@/features/auth/access";
import { EditVendorForm } from "@/components/vendor-forms";
import { safeVendorWebsiteUrl, type VendorRow } from "@/features/procurement/vendor-rules";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const { data, error } = await access.supabase.from("vendors")
    .select("id, name, country, tax_identifier, phone, email, sales_area, contact_name, website, city, products_services_detail, notes, associated_area, archived_at, created_by, created_at, updated_at")
    .eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (error || !data) notFound();
  const vendor = data as VendorRow;
  const websiteUrl = safeVendorWebsiteUrl(vendor.website);
  const fields: Array<[string, string | null]> = [
    ["Proveedor", vendor.name], ["País", vendor.country], ["RIF / identificación fiscal", vendor.tax_identifier],
    ["Teléfono", vendor.phone], ["Correo electrónico", vendor.email], ["Área de venta", vendor.sales_area],
    ["Persona de contacto", vendor.contact_name], ["Sitio web", vendor.website], ["Ciudad", vendor.city],
    ["Detalle de productos y servicios", vendor.products_services_detail],
  ];
  return <div className="page-content">
    <div className="page-heading"><Link className="text-link" href="/procura#proveedores">← Volver a proveedores</Link><span className="eyebrow">DIRECTORIO DE PROVEEDORES</span><h1>{vendor.name}</h1><p>{vendor.archived_at ? "Proveedor eliminado del catálogo activo" : "Ficha comercial del proveedor"}</p></div>
    <section className="work-card detail-card"><h2>Datos comerciales</h2><dl className="detail-grid">
      {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === "Detalle de productos y servicios" ? "vendor-detail-text" : undefined}>
        {label === "Sitio web" && websiteUrl ? <a className="text-link" href={websiteUrl} target="_blank" rel="noopener noreferrer">{value}</a> : value || "—"}
      </dd></div>)}
    </dl></section>
    {!vendor.archived_at && vendor.created_by === access.user.id && <section className="work-card"><h2>Editar proveedor</h2><EditVendorForm vendor={vendor} /></section>}
  </div>;
}
