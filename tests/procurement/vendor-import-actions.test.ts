import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/access", () => ({ getAccessContext: vi.fn() }));
import { getAccessContext } from "@/features/auth/access";
import { inspectVendorImport, previewVendorImport, commitVendorImport } from "../../src/features/procurement/vendor-import-actions";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const org = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const rpc = vi.fn();
const existing = [{ id: "11111111-1111-4111-8111-111111111111", name: "Acme", country: "Venezuela", tax_identifier: "J-001", archived_at: null, created_by: actor }];
const query = () => {
  const chain: Record<string, unknown> = {};
  for (const key of ["select", "eq", "order", "range"]) chain[key] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve({ data: existing, error: null }).then(resolve);
  return chain;
};
const file = () => new File(["Proveedor,País,RIF / identificación fiscal,Teléfono\nAcme,Venezuela,J-001,555\nNuevo,Venezuela,J-002,666"], "directorio.csv", { type: "text/csv" });
const form = (extra: Record<string, string> = {}) => {
  const data = new FormData();
  data.set("file", file());
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccessContext).mockResolvedValue({ kind: "allowed", user: { id: actor }, organizationId: org, supabase: { from: vi.fn(() => query()), rpc } } as never);
  rpc.mockResolvedValue({ data: { batchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", created: 1, updated: 0, skipped: 1, rejected: 0,
    results: [{ sourceRow: 2, status: "skipped" }, { sourceRow: 3, status: "created" }] }, error: null });
});

describe("vendor import actions", () => {
  it("denies inspection without a valid session", async () => {
    vi.mocked(getAccessContext).mockResolvedValue({ kind: "anonymous" } as never);
    expect(await inspectVendorImport(form())).toMatchObject({ kind: "error" });
  });
  it("allows inspecting unfamiliar headers so the user can map them manually", async () => {
    const input = new FormData();
    input.set("file", new File(["Nombre comercial,País\nProveedor Uno,Venezuela"], "otro.csv", { type: "text/csv" }));
    expect(await inspectVendorImport(input)).toMatchObject({ kind: "success", headers: ["Nombre comercial", "País"], mapping: { country: 1 } });
  });
  it("previews matches and new rows without writing", async () => {
    const result = await previewVendorImport(form());
    expect(result).toMatchObject({ kind: "success", counts: { new: 1, match: 1 }, rows: [{ sourceRow: 2, status: "match" }, { sourceRow: 3, status: "new" }] });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("commits only after matching the preview digest and skips matches by default", async () => {
    const preview = await previewVendorImport(form());
    if (preview.kind !== "success") throw new Error("Vista previa falló");
    const result = await commitVendorImport(form({ digest: preview.digest }));
    expect(result).toMatchObject({ kind: "success", counts: { created: 1, updated: 0, skipped: 1, rejected: 0 } });
    expect(rpc.mock.calls[0][1].p_rows.map((row: { mode: string }) => row.mode)).toEqual(["skip", "create"]);
    expect(await commitVendorImport(form({ digest: "incorrecto" }))).toMatchObject({ kind: "error" });
  });
  it("reports a selected update as updated rather than an omitted incident", async () => {
    rpc.mockResolvedValue({ data: { batchId: "id", created: 1, updated: 1, skipped: 0, rejected: 0,
      results: [{ sourceRow: 2, status: "updated" }, { sourceRow: 3, status: "created" }] }, error: null });
    const preview = await previewVendorImport(form());
    if (preview.kind !== "success") throw new Error("Vista previa falló");
    const result = await commitVendorImport(form({ digest: preview.digest, selectedRows: "[2]", selectedFields: '["phone"]' }));
    expect(rpc.mock.calls[0][1].p_rows[0].mode).toBe("update");
    expect(result).toMatchObject({ kind: "success", incidents: [] });
  });
  it("reports a row skipped by the database after preview", async () => {
    rpc.mockResolvedValue({ data: { batchId: "id", created: 0, updated: 0, skipped: 2, rejected: 0,
      results: [{ sourceRow: 2, status: "skipped" }, { sourceRow: 3, status: "skipped" }] }, error: null });
    const preview = await previewVendorImport(form());
    if (preview.kind !== "success") throw new Error("Vista previa falló");
    const result = await commitVendorImport(form({ digest: preview.digest }));
    expect(result).toMatchObject({ kind: "success", incidents: [
      { sourceRow: 2, status: "skipped" }, { sourceRow: 3, status: "skipped" },
    ] });
  });
});
