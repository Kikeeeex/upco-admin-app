import { desc, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { normalizeVendor } from "@/lib/tax/core";
import { apiError, apiUser, audit, toVendor } from "@/lib/tax/server";

export async function GET(request: Request) {
  const denied = await apiUser(); if (denied) return denied;
  try {
    const search = new URL(request.url).searchParams.get("q")?.trim();
    const db = getDb();
    const query = db.select().from(vendors);
    const rows = search ? await query.where(or(like(vendors.rif, `%${search}%`), like(vendors.name, `%${search}%`))).orderBy(desc(vendors.id)) : await query.orderBy(desc(vendors.id));
    return Response.json({ items: rows.map(toVendor) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const denied = await apiUser("vendors.manage"); if (denied) return denied;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const values = normalizeVendor(payload);
    const db = getDb();
    const [row] = await db.insert(vendors).values({ ...values, rif: values.rif!, name: values.name! }).returning();
    await audit("vendor", row.id, "created", row);
    return Response.json(toVendor(row), { status: 201 });
  } catch (error) { return apiError(error); }
}
