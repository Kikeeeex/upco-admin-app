export type DailyBucket = {
  key: "today" | "overdue" | "waiting";
  title: string;
  href: string;
  dateFilter: { operator: "eq" | "lt"; value: string } | null;
  statuses: string[];
};

export function dailyBuckets(today: string): DailyBucket[] {
  const open = ["pending", "in_progress", "waiting"];
  return [
    { key: "today", title: "Para hoy", href: "/mi-trabajo?due=today", dateFilter: { operator: "eq", value: today }, statuses: open },
    { key: "overdue", title: "Vencidas", href: "/mi-trabajo?due=overdue", dateFilter: { operator: "lt", value: today }, statuses: open },
    { key: "waiting", title: "En espera", href: "/mi-trabajo?status=waiting", dateFilter: null, statuses: ["waiting"] },
  ];
}
