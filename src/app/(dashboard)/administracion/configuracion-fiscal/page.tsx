import { FiscalSettingsProposalForm } from "@/components/administration/fiscal-settings-form";
import { activateFiscalSettingsProposal } from "@/features/administration/settings/actions";
import { getAccessContext } from "@/features/auth/access";
import { hasAdministrationPermission, requireAnyAdministrationPermission } from "@/features/administration/permissions/access-control";

export default async function ConfiguracionFiscalPage({ searchParams }: { searchParams?: Promise<{ activacion?: string }> }) {
  const access = await getAccessContext();
  if (access.kind !== "allowed") return null;
  requireAnyAdministrationPermission(access, ["fiscal_settings.read", "fiscal_settings.manage"]);
  const canManage = hasAdministrationPermission(access, "fiscal_settings.manage");
  const activationResult = (await searchParams)?.activacion;
  const { data, error } = await access.supabase.from("fiscal_settings_proposals")
    .select("id, version_no, proposal_label, config_values, created_at")
    .eq("organization_id", access.organizationId).order("version_no", { ascending: false }).limit(10);
  const { data: activeData, error: activeError } = await access.supabase.from("fiscal_settings_activations")
    .select("proposal_id, version_no, activated_at").eq("organization_id", access.organizationId).is("ended_at", null).maybeSingle();
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">ADMINISTRACIÓN</span><h1>Configuración fiscal</h1><p>Parámetros, conceptos, cuentas, CECO y correlativos fiscales.</p></div>
    <p className="administration-lock-note"><strong>Configuración versionada:</strong> las propuestas no afectan documentos hasta activar una versión. Las nuevas emisiones toman la versión activa y guardan una copia inmutable de sus parámetros.</p>
    {activationResult === "ok" && <p className="success-message" role="status">Versión fiscal activada y registrada. Los cálculos y la emisión se habilitarán en las operaciones cuando su integración técnica esté disponible.</p>}
    {activationResult === "error" && <p className="error-message" role="alert">No se pudo activar la versión. Confirma permisos y que las migraciones V2.2 estén aplicadas en este entorno.</p>}
    {activationResult === "sin-permiso" && <p className="error-message" role="alert">Solo una persona administradora puede activar la configuración fiscal.</p>}
    {canManage && <FiscalSettingsProposalForm />}
    <section className="work-card work-list">
      <h2>Historial de propuestas</h2>
      {error ? <p className="error-message" role="alert">No se pudo cargar el historial. Aplica las migraciones de Administración V2.</p> : !data?.length ?
        <p className="work-empty">Todavía no hay propuestas fiscales.</p> :
        <ol className="proposal-list">{data.map((proposal) => <li key={proposal.id}>
          <div><strong>V{proposal.version_no} · {proposal.proposal_label}</strong><span>{new Date(proposal.created_at).toLocaleString("es-VE", { timeZone: "America/Caracas" })}</span>
            {activeData && activeData.proposal_id === proposal.id ? <span className="badge">Activa · {activeData.version_no}</span> : <span className="badge">Propuesta · no activa</span>}
          </div>
          <details><summary>Ver valores propuestos</summary><pre>{JSON.stringify(proposal.config_values, null, 2)}</pre></details>
          {access.role === "admin" && activeData?.proposal_id !== proposal.id && <form action={activateFiscalSettingsProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button type="submit" className="quiet-button">Activar esta versión aprobada</button>
          </form>}
        </li>)}</ol>}
    </section>
    {activeError && <p className="error-message" role="alert">No se pudo consultar la versión fiscal activa. Aplica la migración V2.2.</p>}
    {activeData && <p className="muted-note">Configuración activa desde {new Date(activeData.activated_at).toLocaleString("es-VE", { timeZone: "America/Caracas" })}. La activación conserva su versión y su historial.</p>}
  </div>;
}
