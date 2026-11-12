"use client";

import { useActionState } from "react";
import { ADMINISTRATION_PERMISSION_OPTIONS, type AdministrationPermission } from "@/features/administration/permissions/catalog";
import { replaceMemberAdministrationPermissions, type AdministrationPermissionsActionState } from "@/features/administration/permissions/actions";

const initial: AdministrationPermissionsActionState = { kind: "idle", message: "" };

export function AdministrationPermissionsForm({
  userId, displayName, currentPermissions,
}: { userId: string; displayName: string; currentPermissions: AdministrationPermission[] }) {
  const [state, action, pending] = useActionState(replaceMemberAdministrationPermissions, initial);
  return <section className="work-card">
    <h2>{displayName}</h2>
    <p className="muted-note">ID de membresía: <code>{userId}</code>. Sin permisos asignados, no puede consultar datos de Administración.</p>
    <form action={action} className="work-form">
      <input type="hidden" name="userId" value={userId} />
      <fieldset className="permission-options">
        <legend>Permisos de Administración</legend>
        {ADMINISTRATION_PERMISSION_OPTIONS.map(({ key, label, description }) => <label className="permission-option" key={key}>
          <input type="checkbox" name="permission" value={key} defaultChecked={currentPermissions.includes(key)} />
          <span><strong>{label}</strong><small>{description}</small></span>
        </label>)}
      </fieldset>
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar permisos"}</button>
    </form>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}
