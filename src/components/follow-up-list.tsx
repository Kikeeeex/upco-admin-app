import Link from "next/link";
import type { AdminFollowUp } from "@/features/administration/follow-ups";

export type AgendaItem = Pick<AdminFollowUp, "id" | "work_item_id" | "scheduled_for" | "contact_name" | "reason"> & {
  work_items: { id: string; code: string; title: string };
};

export function FollowUpAgenda({ today, items }: { today: string; items: AgendaItem[] }) {
  if (items.length === 0) return <p className="work-empty">No hay seguimientos pendientes.</p>;
  return <ul className="follow-up-list">{items.map((item) => {
    const timing = item.scheduled_for < today ? "Vencido" : item.scheduled_for === today ? "Hoy" : "Próximo";
    return <li key={item.id}>
      <span className="badge">{timing} · {item.scheduled_for}</span>
      <Link className="text-link" href={`/administracion/${item.work_item_id}`}>{item.work_items.code} · {item.work_items.title}</Link>
      <span>{item.reason} · {item.contact_name}</span>
    </li>;
  })}</ul>;
}
