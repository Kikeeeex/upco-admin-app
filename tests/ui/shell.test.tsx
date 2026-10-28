import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../src/components/app-shell";
import { PendingPage } from "../../src/components/pending-page";

describe("AppShell", () => {
  it("offers every required area and common view", () => {
    const html = renderToStaticMarkup(<AppShell><p>Contenido</p></AppShell>);
    for (const label of ["Inicio", "Mi trabajo", "Administración", "Procura", "Tecnología", "Proyectos", "Seguimientos", "Reportes", "Configuración"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Contenido");
  });
});

describe("PendingPage", () => {
  it("labels unfinished modules without claiming live data", () => {
    const html = renderToStaticMarkup(<PendingPage title="Procura" />);
    expect(html).toContain("Procura");
    expect(html).toContain("pendiente de implementación");
  });
});
