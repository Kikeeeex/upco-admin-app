import { getSqlite } from "@/db";
import { ISLR_CONCEPTS } from "@/lib/tax/islrConcepts";
import { fail, normalizeSettings, todayCaracas, type TaxSettings } from "@/lib/tax/core";
import { apiError, apiUser, readSettings } from "@/lib/tax/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { nextCertificateNumber } from "@/lib/tax/certificateSequences";
import historicalMaxima from "@/import/certificate_maxima.json";

const GLOBAL_SEQUENCE = "*";
type CertificateKind = "iva" | "islr";
const historical = historicalMaxima as Record<string, Partial<Record<CertificateKind, { maxCertificate: string }>>>;
function historicalFloor(kind: CertificateKind) {
  return Math.max(0, ...Object.entries(historical)
    .filter(([month]) => /^\d{4}(0[1-9]|1[0-2])$/.test(month))
    .map(([, value]) => Number(value[kind]?.maxCertificate?.slice(6)) || 0));
}
function certificateColumn(kind: CertificateKind) {
  return kind === "iva" ? "iva_certificate_number" : "islr_certificate_number";
}
function highestActiveNumber(db: ReturnType<typeof getSqlite>, kind: CertificateKind) {
  const column = certificateColumn(kind);
  const row = db.prepare(`SELECT max(CAST(substr(${column}, 7) AS INTEGER)) AS number FROM documents
    WHERE length(${column}) = 14 AND substr(${column}, 5, 2) BETWEEN '01' AND '12'`).get() as { number: number | null };
  return Number(row.number) || 0;
}

function periodFrom(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || todayCaracas().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) fail("Período inválido");
  return period;
}

function sequences(period: string) {
  const db = getSqlite();
  const next = (kind: CertificateKind) => {
    const row = db.prepare("SELECT last_number FROM certificate_sequences WHERE kind = ? AND period = ?")
      .get(kind, GLOBAL_SEQUENCE) as { last_number: number } | undefined;
    const retiredMax = db.prepare("SELECT max(number) AS number FROM retired_certificate_numbers WHERE kind = ?")
      .get(kind) as { number: number | null };
    const suggestedNextNumber = Math.max(historicalFloor(kind), row?.last_number || 0,
      highestActiveNumber(db, kind), Number(retiredMax.number) || 0) + 1;
    return { period, nextNumber: row ? nextCertificateNumber(db, kind, period)!.number : suggestedNextNumber, suggestedNextNumber, configured: Boolean(row) };
  };
  return { iva: next("iva"), islr: next("islr") };
}

function present(settings: TaxSettings, period: string) {
  const latest = settings.unitTaxHistory.at(-1)!;
  return {
    ...settings,
    certificateSequences: sequences(period),
    unitTaxValue: latest.value,
    unitTaxEffectiveAt: latest.effectiveAt,
    islrConcepts: ISLR_CONCEPTS.map(concept => ({ ...concept, ...(settings.conceptOverrides[concept.code] ?? {}) })),
  };
}
export async function GET(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try { const period = periodFrom(request); return Response.json(present(await readSettings(), period)); } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const prior = await readSettings();
    const payload = await request.json() as Record<string, unknown>;
    const user = await currentUser();
    if (!user) return Response.json({ error: "Sesión vencida." }, { status: 401 });
    if (user.role !== "master") {
      if (!hasPermission(user, "catalogs.manage")) return Response.json({ error: "No tienes permiso para administrar catálogos." }, { status: 403 });
      if (Object.keys(payload).some(key => key !== "cecos" && key !== "paymentAccounts")) {
        return Response.json({ error: "Solo el usuario master puede modificar las reglas fiscales y correlativos." }, { status: 403 });
      }
    }
    const period = periodFrom(request);
    const sequenceInput = payload.certificateSequences;
    delete payload.certificateSequences;
    if (payload.unitTaxValue !== undefined) {
      const effectiveAt = String(payload.unitTaxEffectiveAt ?? todayCaracas());
      payload.unitTaxHistory = [...prior.unitTaxHistory.filter(x => x.effectiveAt !== effectiveAt), { effectiveAt, value: Number(payload.unitTaxValue) }];
      delete payload.unitTaxValue; delete payload.unitTaxEffectiveAt;
    }
    const settings = normalizeSettings(payload, prior);
    const requested: { kind: "iva" | "islr"; nextNumber: number }[] = [];
    if (sequenceInput !== undefined) {
      if (!sequenceInput || typeof sequenceInput !== "object") fail("Correlativos inválidos");
      for (const kind of ["iva", "islr"] as const) {
        const value = (sequenceInput as Record<string, unknown>)[kind];
        if (value === undefined) continue;
        if (!value || typeof value !== "object") fail(`Correlativo ${kind} inválido`);
        const item = value as Record<string, unknown>;
        if (String(item.period) !== period) fail(`El correlativo ${kind} debe corresponder al período ${period}`);
        const nextNumber = Number(item.nextNumber);
        if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 99_999_999) fail(`Próximo correlativo ${kind} inválido`);
        requested.push({ kind, nextNumber });
      }
    }
    const db = getSqlite();
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of requested) {
        const retired = db.prepare("SELECT max(number) AS highest FROM retired_certificate_numbers WHERE kind = ?")
          .get(item.kind) as { highest: number | null };
        const sequence = db.prepare("SELECT last_number FROM certificate_sequences WHERE kind = ? AND period = ?")
          .get(item.kind, GLOBAL_SEQUENCE) as { last_number: number } | undefined;
        const highest = Math.max(Number(retired.highest) || 0, highestActiveNumber(db, item.kind),
          sequence?.last_number || 0, historicalFloor(item.kind));
        const next = nextCertificateNumber(db, item.kind, period);
        // A released number is the only valid manual choice below the high-water mark.
        if (next?.released && item.nextNumber !== next.number) {
          fail(`Hay un correlativo ${item.kind.toUpperCase()} liberado: ${next.number}. Debe usarse antes de avanzar.`);
        }
        if (next?.released && item.nextNumber === next.number) continue;
        if (item.nextNumber <= highest) {
          fail(`El próximo correlativo continuo ${item.kind.toUpperCase()} debe superar ${highest} ya emitido o reservado`);
        }
        db.prepare("INSERT INTO certificate_sequences (kind, period, last_number) VALUES (?, ?, ?) ON CONFLICT(kind,period) DO UPDATE SET last_number = excluded.last_number")
          .run(item.kind, GLOBAL_SEQUENCE, item.nextNumber - 1);
      }
      db.prepare("INSERT INTO app_settings (key,value,updated_at) VALUES ('tax',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
        .run(JSON.stringify(settings), new Date().toISOString());
      db.prepare("INSERT INTO audit_events (entity_type,entity_id,action,snapshot) VALUES ('settings',0,'updated',?)")
        .run(JSON.stringify({ before: prior, after: settings, sequences: requested }));
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return Response.json(present(settings, period));
  } catch (error) { return apiError(error); }
}
