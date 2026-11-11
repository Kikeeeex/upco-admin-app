import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, vendors } from "@/db/schema";
import { fiscalHalf, money, todayCaracas } from "@/lib/tax/core";
import { apiError, apiUser } from "@/lib/tax/server";

export async function GET(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const current = fiscalHalf(todayCaracas());
    const period = params.get("period") ?? current.period;
    const half = params.get("half") ? Number(params.get("half")) : undefined;
    const db = getDb();
    const [allVendors, rows] = await Promise.all([
      db.select().from(vendors),
      db.select().from(documents).where(and(eq(documents.period, period), half ? eq(documents.half, half) : undefined)),
    ]);
    const issued = rows.filter(x => x.status === "issued");
    const sum = (key: keyof typeof documents.$inferSelect) => issued.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    return Response.json({
      period, half: half ?? null,
      vendors: allVendors.filter(x => x.active).length,
      documents: rows.length,
      issued: issued.length,
      drafts: rows.length - issued.length,
      invoiceTotal: money(sum("totalCents")),
      ivaRetained: money(sum("ivaRetentionCents")),
      islrRetained: money(sum("islrRetentionCents")),
      netPayable: money(sum("netPayableCents")),
      mixedRateDocuments: rows.filter(x => x.base16Cents !== 0 && x.base8Cents !== 0).length,
      shiftedPeriods: rows.filter(x => Boolean(x.periodOverrideReason)).length,
    });
  } catch (error) { return apiError(error); }
}
