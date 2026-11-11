import { randomBytes } from "node:crypto";
import { getSqlite } from "@/db";
import { passwordHash } from "@/lib/auth";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { apiError, apiUser } from "@/lib/tax/server";

function publicUsers() {
  return getSqlite().prepare("SELECT id, username, role, permissions, active, created_at AS createdAt FROM users ORDER BY id")
    .all().map(row => {
      const user = row as Record<string, unknown>;
      return { ...user, permissions: JSON.parse(String(user.permissions)), active: Boolean(user.active) };
    });
}

export async function GET() {
  const denied = await apiUser("master"); if (denied) return denied;
  try { return Response.json({ items: publicUsers() }); } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const denied = await apiUser("master"); if (denied) return denied;
  try {
    const body = await request.json() as Record<string, unknown>;
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return Response.json({ error: "Usuario: 3 a 40 letras, números, punto, guion o guion bajo." }, { status: 400 });
    if (password.length < 12 || password.length > 128) return Response.json({ error: "La contraseña debe tener entre 12 y 128 caracteres." }, { status: 400 });
    if (!Array.isArray(body.permissions) || body.permissions.some(item => !PERMISSIONS.includes(item as Permission))) {
      return Response.json({ error: "Permisos inválidos." }, { status: 400 });
    }
    const permissions = [...new Set(body.permissions as Permission[])];
    const salt = randomBytes(24).toString("hex");
    const db = getSqlite();
    const result = db.prepare("INSERT INTO users (username,password_hash,salt,role,permissions) VALUES (?,?,?,'operator',?)")
      .run(username, passwordHash(password, salt), salt, JSON.stringify(permissions));
    db.prepare("INSERT INTO audit_events (entity_type,entity_id,action,snapshot) VALUES ('user',?,'created',?)")
      .run(Number(result.lastInsertRowid), JSON.stringify({ username, role: "operator", permissions }));
    return Response.json({ items: publicUsers() }, { status: 201 });
  } catch (error) { return apiError(error); }
}
