"use client";

import { useActionState } from "react";
import { voidAdministrationDocument, type AdministrationDraftActionState } from "@/features/administration/documents/actions";

const initial: AdministrationDraftActionState = { kind: "idle", message: "" };

export function VoidDocumentForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(voidAdministrationDocument, initial);
  return <section className="work-card">
    <h2>Anular documento emitido</h2>
    <p className="administration-lock-note">La anulación conserva el comprobante y su auditoría. Los correlativos no se liberan ni se reutilizan.</p>
    <form action={action} className="work-form">
      <input type="hidden" name="id" value={documentId} />
      <div className="field"><label htmlFor="void-reason">Motivo de anulación</label><textarea id="void-reason" name="reason" required minLength={10} maxLength={1000} rows={3} /></div>
      <button className="quiet-button" type="submit" disabled={pending}>{pending ? "Anulando…" : "Anular documento"}</button>
    </form>
    {state.message && <p role="status" className={state.kind === "error" ? "error-message" : "success-message"}>{state.message}</p>}
  </section>;
}
