import Link from "next/link";
import { notFound } from "next/navigation";
import { EditFiscalVendorForm } from "@/components/administration/fiscal-vendor-forms";
import { getAccessContext } from "@/features/auth/access";

type FiscalVendor = {
  id: string; organization_id: string; legal_name: string; tax_identifier: string; tax_address: string;
  taxpayer_type: string | null; person_type: "natural" | "legal"; residency: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  iva_retention_rate: number; fiscal_machine_numbers: string | null; active: boolean;
  review_state: "needs_review" | "confirmed"; review_notes: string | null; procurement_vendor_id: string | null;
  created_at: string; updated_at: string;
};

export default async function FiscalVendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") notFound();
  const { id } = await params;
  const { data, error } = await access.supabase.from("fiscal_vendors").select("*")
    .eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (error || !data) notFound();
  const vendor = data as FiscalVendor;
  return <div className="page-content">
    <div className="page-heading"><Link className="text-link" href="/administracion/proveedores">← Proveedores</Link><span className="eyebrow">DIRECTORIO FISCAL</span><h1>{vendor.legal_name}</h1><p>{vendor.tax_identifier}</p></div>
    <section className="work-card">
      <div className="status-row"><span className="badge">{vendor.active ? "Activo" : "Inactivo"}</span><span className="badge">{vendor.review_state === "confirmed" ? "Confirmado" : "Por revisar"}</span></div>
      {vendor.procurement_vendor_id && <p className="muted-note">Vinculado con un registro comercial de Procura.</p>}
      {access.role === "admin" ? <EditFiscalVendorForm vendor={vendor} /> : <p>Solo el administrador puede editar proveedores fiscales.</p>}
    </section>
  </div>;
}
