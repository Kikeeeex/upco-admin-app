type RawFilter = string | string[] | undefined;
export type RawWorkItemFilters = {
  q?: RawFilter; area?: RawFilter; status?: RawFilter; priority?: RawFilter;
  site?: RawFilter; due?: RawFilter;
};

export type WorkItemFilters = {
  query: string; area: string; status: string; priority: string; site: string; due: string;
};

const areas = new Set(["general", "administration", "procurement", "it"]);
const statuses = new Set(["pending", "in_progress", "waiting", "completed", "cancelled"]);
const priorities = new Set(["low", "medium", "high", "critical"]);
const dueFilters = new Set(["overdue", "today", "upcoming", "none"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(value: RawFilter): string {
  return typeof value === "string" ? value : "";
}

export function parseWorkItemFilters(raw: RawWorkItemFilters): WorkItemFilters {
  const query = single(raw.q).trim();
  const area = single(raw.area);
  const status = single(raw.status);
  const priority = single(raw.priority);
  const site = single(raw.site);
  const due = single(raw.due);
  return {
    query: query.length <= 100 ? query : "",
    area: areas.has(area) ? area : "",
    status: statuses.has(status) ? status : "",
    priority: priorities.has(priority) ? priority : "",
    site: uuid.test(site) ? site.toLowerCase() : "",
    due: dueFilters.has(due) ? due : "",
  };
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function hasUnsupportedSearch(value: string): boolean {
  // PostgREST expands * to % before the pattern reaches PostgreSQL.
  return value.includes("*");
}

export function localDateInTimezone(instant: Date, timezone: string): string {
  const makeDate = (zone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(instant);
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  try { return makeDate(timezone); }
  catch { return makeDate("America/Caracas"); }
}

export function workItemListHref(filters: WorkItemFilters, activePage: number, archivePage: number): string {
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  if (filters.area) query.set("area", filters.area);
  if (filters.status) query.set("status", filters.status);
  if (filters.priority) query.set("priority", filters.priority);
  if (filters.site) query.set("site", filters.site);
  if (filters.due) query.set("due", filters.due);
  query.set("activos", String(activePage));
  query.set("archivo", String(archivePage));
  return `/mi-trabajo?${query.toString()}`;
}
