import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, vendors } from "@/db/schema";
import type { JoinedDocument } from "./exports";

export async function allJoined(): Promise<JoinedDocument[]> {
  const db = getDb();
  return db.select({ document: documents, vendor: vendors }).from(documents).innerJoin(vendors, eq(documents.vendorId, vendors.id));
}
