import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.UPCO_DATA_DIR || path.join(process.cwd(), "data"));
export const databasePath = path.join(dataDir, "upco.sqlite");

let sqlite: DatabaseSync | undefined;
let db: ReturnType<typeof createDb> | undefined;

function openSqlite() {
  if (!sqlite) {
    mkdirSync(dataDir, { recursive: true });
    sqlite = new DatabaseSync(databasePath, { timeout: 5000 });
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  }
  return sqlite;
}

function createDb() {
  const client = openSqlite();
  return drizzle(async (query, params, method) => {
    const statement = client.prepare(query);
    statement.setReturnArrays(true);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    if (method === "get") return { rows: (statement.get(...params) as unknown as unknown[]) ?? [] };
    return { rows: statement.all(...params) as unknown as unknown[][] };
  }, { schema });
}

export function getDb() {
  db ??= createDb();
  return db;
}

export function getSqlite() { return openSqlite(); }
