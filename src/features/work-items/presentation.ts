export function parsePageNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,4}$/.test(value)) return 1;
  const page = Number(value);
  return page <= 10000 ? page : 1;
}

export function formatWorkItemDateTime(value: string | null, timezone: string): string {
  if (!value) return "—";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: timezone,
  };
  try { return new Intl.DateTimeFormat("es-VE", options).format(instant); }
  catch { return new Intl.DateTimeFormat("es-VE", { ...options, timeZone: "America/Caracas" }).format(instant); }
}
