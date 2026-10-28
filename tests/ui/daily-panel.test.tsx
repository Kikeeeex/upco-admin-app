import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyPanel } from "../../src/components/daily-panel";
import { dailyBuckets } from "../../src/features/work-items/daily";

const [today, overdue] = dailyBuckets("2026-10-28");

describe("DailyPanel", () => {
  it("shows the exact count and links to item and matching full list", () => {
    const html = renderToStaticMarkup(<DailyPanel bucket={today} count={6} error={false} items={[
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "ADM-6", title: "Preparar informe", due_date: "2026-10-28" },
    ]} />);
    expect(html).toContain("Para hoy");
    expect(html).toContain("6 actividades");
    expect(html).toContain("Preparar informe");
    expect(html).toContain('/mi-trabajo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(html).toContain('/mi-trabajo?due=today');
  });

  it("shows a query error instead of a misleading zero", () => {
    const html = renderToStaticMarkup(<DailyPanel bucket={overdue} count={null} error items={[]} />);
    expect(html).toContain("No se pudieron cargar las actividades vencidas");
    expect(html).not.toContain("0 actividades");
  });
});
