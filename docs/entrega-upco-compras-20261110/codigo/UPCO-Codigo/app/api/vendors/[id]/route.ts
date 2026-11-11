import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { InputError, normalizeVendor } from "@/lib/tax/core";
import { apiError, apiUser, audit, findVendor, toVendor } from "@/lib/tax/server";

type Context = { params: Promise<{ id: string }> };
async function existing(context: Context) {
  const { id } = await context.params;
  const row = await findVendor(Number(id));
  if (!row) throw new InputError("Proveedor no encontrado");
  return row;
}
export async function GET(_request: Request, context: Context) {
  const denied = await apiUser(); if (denied) return denied;
  try { return Response.json(toVendor(await existing(context))); } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = await apiUser("vendors.manage"); if (denied) return denied;
  try {
    const old = await existing(context);
    const payload = await request.json() as Record<string, unknown>;
    const values = normalizeVendor({ ...old, ...payload });
    const db = getDb();
    const [row] = await db.update(vendors).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(vendors.id, old.id)).returning();
    await audit("vendor", old.id, "updated", { before: old, after: row });
    return Response.json(toVendor(row));
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, context: Context) {
  const denied = await apiUser("vendors.manage"); if (denied) return denied;
  try {
    const old = await existing(context);
    const db = getDb();
    const [row] = await db.update(vendors).set({ active: false, updatedAt: new Date().toISOString() }).where(eq(vendors.id, old.id)).returning();
    await audit("vendor", old.id, "archived", row);
    return Response.json(toVendor(row));
  } catch (error) { return apiError(error); }
}
