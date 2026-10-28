import Link from "next/link";
import type { DailyBucket } from "@/features/work-items/daily";

export type DailyItem = { id: string; code: string; title: string; due_date: string | null };

export function DailyPanel({ bucket, count, error, items }: { bucket: DailyBucket; count: number | null; error: boolean; items: DailyItem[] }) {
  const errorName = bucket.key === "overdue" ? "vencidas" : bucket.key === "today" ? "para hoy" : "en espera";
  return <section className="work-card daily-panel">
    <div className="daily-panel-heading"><h2>{bucket.title}</h2>{!error && <strong>{count ?? 0} {(count ?? 0) === 1 ? "actividad" : "actividades"}</strong>}</div>
    {error ? <p className="error-message" role="alert">No se pudieron cargar las actividades {errorName}.</p> :
      items.length === 0 ? <p className="work-empty">No hay actividades en este grupo.</p> :
      <ul className="daily-list">{items.map((item) => <li key={item.id}>
        <Link href={`/mi-trabajo/${item.id}`}>{item.title}</Link>
        <span>{item.code}{item.due_date ? ` · ${item.due_date}` : ""}</span>
      </li>)}</ul>}
    <Link className="text-link" href={bucket.href}>Ver lista completa →</Link>
  </section>;
}
