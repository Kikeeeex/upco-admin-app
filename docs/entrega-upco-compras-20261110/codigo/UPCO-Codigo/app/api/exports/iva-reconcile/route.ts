import { apiError, apiUser } from "@/lib/tax/server";
import { ivaReconciliation, parsePeriod } from "@/lib/tax/exports";
import { allJoined } from "@/lib/tax/exportData";

export async function GET(request: Request) {
  const denied = await apiUser("exports.run"); if (denied) return denied;
  try {
    const { period, half } = parsePeriod(request, true);
    return Response.json(ivaReconciliation(await allJoined(), period, half!));
  } catch (error) { return apiError(error); }
}
