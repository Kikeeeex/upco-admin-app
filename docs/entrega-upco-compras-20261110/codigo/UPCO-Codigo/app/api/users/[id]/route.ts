import { randomBytes } from "node:crypto";
import { getSqlite } from "@/db";
import { currentUser, passwordHash } from "@/lib/auth";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { apiError, apiUser } from "@/lib/tax/server";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const denied = await apiUser("master"); if (denied) return denied;
  try {
    const actor = await currentUser();
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Usuario inválido." }, { status: 400 });
    const db = getSqlite();
    const old = db.prepare("SELECT id, username, role, permissions, active FROM users WHERE id = ?").get(id) as
      { id: number; username: string; role: string; permissions: string; active: number } | undefined;
    if (!old) return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
    if (old.role === "master") return Response.json({ error: "El usuario master no puede desactivarse ni cambiar sus permisos aquí." }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    if (Object.keys(body).some(key => !["active", "permissions", "password"].includes(key))) return Response.json({ error: "Campo inválido." }, { status: 400 });
    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions) || body.permissions.some(item => !PERMISSIONS.includes(item as Permission))) return Response.json({ error: "Permisos inválidos." }, { status: 400 });
    }
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return Response.json({ error: "Estado inválido." }, { status: 400 });
    }
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 12 || password.length > 128) return Response.json({ error: "La contraseña debe tener entre 12 y 128 caracteres." }, { status: 400 });
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      if (body.permissions !== undefined) db.prepare("UPDATE users SET permissions = ? WHERE id = ?")
        .run(JSON.stringify([...new Set(body.permissions as Permission[])]), id);
      if (body.active !== undefined) db.prepare("UPDATE users SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
      if (body.password !== undefined) {
        const password = String(body.password);
      const salt = randomBytes(24).toString("hex");
      db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(passwordHash(password, salt), salt, id);
      }
      if (body.active === false || body.password !== undefined) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
      db.prepare("INSERT INTO audit_events (entity_type,entity_id,action,snapshot) VALUES ('user',?,'updated',?)")
        .run(id, JSON.stringify({ actorId: actor?.id, username: old.username, active: body.active, permissions: body.permissions, passwordReset: body.password !== undefined }));
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
