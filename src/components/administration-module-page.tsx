type AdministrationModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  blockedReason?: string;
};

export function AdministrationModulePage({ eyebrow, title, description, status, blockedReason }: AdministrationModulePageProps) {
  return <div className="page-content">
    <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    <section className="work-card administration-status-card" aria-labelledby="administration-module-status">
      <span className="badge">{status}</span>
      <h2 id="administration-module-status">Disponible por etapas</h2>
      <p>Este apartado forma parte de Administración V2. Sus funciones se habilitarán por etapas.</p>
      {blockedReason && <p className="notice-message">{blockedReason}</p>}
    </section>
  </div>;
}
