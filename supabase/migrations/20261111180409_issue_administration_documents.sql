ALTER TABLE public.administration_documents
  DROP CONSTRAINT administration_documents_status_check,
  ADD CONSTRAINT administration_documents_status_check CHECK (status IN ('draft', 'issued')),
  ADD COLUMN calculation_snapshot jsonb,
  ADD COLUMN settings_snapshot jsonb,
  ADD COLUMN accounting_snapshot jsonb,
  ADD COLUMN iva_certificate_number text,
  ADD COLUMN islr_certificate_number text,
  ADD COLUMN issued_by uuid REFERENCES auth.users(id),
  ADD COLUMN issued_at_timestamp timestamptz;
CREATE UNIQUE INDEX administration_documents_iva_certificate_unique_idx
  ON public.administration_documents(organization_id, iva_certificate_number) WHERE iva_certificate_number IS NOT NULL;
CREATE UNIQUE INDEX administration_documents_islr_certificate_unique_idx
  ON public.administration_documents(organization_id, islr_certificate_number) WHERE islr_certificate_number IS NOT NULL;

-- Fiscal records and tax snapshots are initially restricted to the administrator role.
DROP POLICY IF EXISTS fiscal_vendors_member_read ON public.fiscal_vendors;
DROP POLICY IF EXISTS fiscal_vendors_admin_read ON public.fiscal_vendors;
CREATE POLICY fiscal_vendors_admin_read ON public.fiscal_vendors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_vendors.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS fiscal_vendor_events_member_read ON public.fiscal_vendor_events;
DROP POLICY IF EXISTS fiscal_vendor_events_admin_read ON public.fiscal_vendor_events;
CREATE POLICY fiscal_vendor_events_admin_read ON public.fiscal_vendor_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_vendor_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS fiscal_settings_proposals_member_read ON public.fiscal_settings_proposals;
DROP POLICY IF EXISTS fiscal_settings_proposals_admin_read ON public.fiscal_settings_proposals;
CREATE POLICY fiscal_settings_proposals_admin_read ON public.fiscal_settings_proposals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_settings_proposals.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS fiscal_settings_events_member_read ON public.fiscal_settings_events;
DROP POLICY IF EXISTS fiscal_settings_events_admin_read ON public.fiscal_settings_events;
CREATE POLICY fiscal_settings_events_admin_read ON public.fiscal_settings_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_settings_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS fiscal_settings_activations_member_read ON public.fiscal_settings_activations;
DROP POLICY IF EXISTS fiscal_settings_activations_admin_read ON public.fiscal_settings_activations;
CREATE POLICY fiscal_settings_activations_admin_read ON public.fiscal_settings_activations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_settings_activations.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS administration_documents_member_read ON public.administration_documents;
DROP POLICY IF EXISTS administration_documents_admin_read ON public.administration_documents;
CREATE POLICY administration_documents_admin_read ON public.administration_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = administration_documents.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
DROP POLICY IF EXISTS administration_document_events_member_read ON public.administration_document_events;
DROP POLICY IF EXISTS administration_document_events_admin_read ON public.administration_document_events;
CREATE POLICY administration_document_events_admin_read ON public.administration_document_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = administration_document_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));

CREATE TABLE public.fiscal_certificate_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  kind text NOT NULL CHECK (kind IN ('iva', 'islr')),
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 99999999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, kind)
);
ALTER TABLE public.fiscal_certificate_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_certificate_sequences_member_read ON public.fiscal_certificate_sequences FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = fiscal_certificate_sequences.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'));
REVOKE ALL ON public.fiscal_certificate_sequences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_certificate_sequences TO authenticated;

ALTER TABLE public.administration_document_events DROP CONSTRAINT administration_document_events_action_check;
ALTER TABLE public.administration_document_events ADD CONSTRAINT administration_document_events_action_check
  CHECK (action IN ('draft_created', 'draft_updated', 'issued'));

CREATE OR REPLACE FUNCTION public.prepare_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'documents must be created as drafts' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'issued' THEN
    RAISE EXCEPTION 'issued documents are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'issued' AND current_setting('app.administration_issue', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'issue only through the authorized transaction' USING ERRCODE = '55000';
  END IF;
  IF NEW.status = 'draft' AND (NEW.calculation_snapshot IS NOT NULL OR NEW.settings_snapshot IS NOT NULL OR NEW.accounting_snapshot IS NOT NULL
    OR NEW.iva_certificate_number IS NOT NULL OR NEW.islr_certificate_number IS NOT NULL OR NEW.issued_by IS NOT NULL OR NEW.issued_at_timestamp IS NOT NULL) THEN
    RAISE EXCEPTION 'drafts cannot carry an issued fiscal snapshot' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'issued' AND (NEW.calculation_snapshot IS NULL OR NEW.settings_snapshot IS NULL OR NEW.accounting_snapshot IS NULL
    OR NEW.issued_by IS NULL OR NEW.issued_at_timestamp IS NULL) THEN
    RAISE EXCEPTION 'issued document requires immutable snapshots' USING ERRCODE = '23514';
  END IF;
  IF NEW.affected_document_id IS NOT NULL AND (
    NEW.document_type = 'invoice' OR NEW.fiscal_vendor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.administration_documents affected
      WHERE affected.id = NEW.affected_document_id AND affected.organization_id = NEW.organization_id
        AND affected.document_type = 'invoice' AND affected.status = 'issued' AND affected.fiscal_vendor_id = NEW.fiscal_vendor_id
    )
  ) THEN
    RAISE EXCEPTION 'affected invoice must be issued and belong to the same fiscal vendor' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'document identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'draft' OR (NEW.status NOT IN ('draft', 'issued')) THEN
      RAISE EXCEPTION 'invalid document status transition' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid;
  v_action text;
BEGIN
  IF NEW.status = 'issued' THEN
    v_actor := NEW.issued_by;
    v_action := 'issued';
  ELSE
    v_actor := auth.uid();
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'draft_created' ELSE 'draft_updated' END;
  END IF;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'document changes require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.administration_document_events(organization_id, document_id, actor_id, action)
  VALUES (NEW.organization_id, NEW.id, v_actor, v_action);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_administration_document(
  p_document_id uuid,
  p_actor_id uuid,
  p_draft_fields jsonb,
  p_calculation_snapshot jsonb,
  p_settings_snapshot jsonb,
  p_accounting_snapshot jsonb,
  p_iva_initial_next integer,
  p_islr_initial_next integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_document public.administration_documents%ROWTYPE;
  v_iva_number text;
  v_islr_number text;
  v_next integer;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.memberships m JOIN public.administration_documents d ON d.organization_id = m.organization_id
    WHERE d.id = p_document_id AND m.user_id = p_actor_id AND m.active AND m.role = 'admin'
  ) THEN RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_draft_fields) <> 'object' OR jsonb_typeof(p_calculation_snapshot) <> 'object' OR jsonb_typeof(p_settings_snapshot) <> 'object'
    OR jsonb_typeof(p_accounting_snapshot) <> 'object' THEN RAISE EXCEPTION 'snapshots required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_document FROM public.administration_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.status <> 'draft' THEN RAISE EXCEPTION 'draft unavailable for issue' USING ERRCODE = '55000'; END IF;
  IF coalesce((p_calculation_snapshot->>'ivaRetentionCents')::bigint, 0) <> 0 THEN
    IF p_iva_initial_next IS NULL OR p_iva_initial_next < 1 OR p_iva_initial_next > 99999999 THEN RAISE EXCEPTION 'IVA sequence is not initialized' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.fiscal_certificate_sequences(organization_id, kind, last_number)
      VALUES (v_document.organization_id, 'iva', p_iva_initial_next - 1)
      ON CONFLICT (organization_id, kind) DO NOTHING;
    UPDATE public.fiscal_certificate_sequences SET last_number = last_number + 1, updated_at = now()
      WHERE organization_id = v_document.organization_id AND kind = 'iva' AND last_number < 99999999 RETURNING last_number INTO v_next;
    IF v_next IS NULL THEN RAISE EXCEPTION 'IVA sequence exhausted' USING ERRCODE = '22003'; END IF;
    v_iva_number := replace(p_calculation_snapshot->>'period', '-', '') || lpad(v_next::text, 8, '0');
  END IF;
  IF coalesce((p_calculation_snapshot->>'islrRetentionCents')::bigint, 0) <> 0 THEN
    IF p_islr_initial_next IS NULL OR p_islr_initial_next < 1 OR p_islr_initial_next > 99999999 THEN RAISE EXCEPTION 'ISLR sequence is not initialized' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.fiscal_certificate_sequences(organization_id, kind, last_number)
      VALUES (v_document.organization_id, 'islr', p_islr_initial_next - 1)
      ON CONFLICT (organization_id, kind) DO NOTHING;
    UPDATE public.fiscal_certificate_sequences SET last_number = last_number + 1, updated_at = now()
      WHERE organization_id = v_document.organization_id AND kind = 'islr' AND last_number < 99999999 RETURNING last_number INTO v_next;
    IF v_next IS NULL THEN RAISE EXCEPTION 'ISLR sequence exhausted' USING ERRCODE = '22003'; END IF;
    v_islr_number := replace(p_calculation_snapshot->>'eventAt', '-', '')::text;
    v_islr_number := substr(v_islr_number, 1, 6) || lpad(v_next::text, 8, '0');
  END IF;
  PERFORM set_config('app.administration_issue', 'on', true);
  UPDATE public.administration_documents SET
    fiscal_vendor_id = nullif(p_draft_fields->>'fiscal_vendor_id', '')::uuid,
    document_type = p_draft_fields->>'document_type',
    invoice_number = nullif(p_draft_fields->>'invoice_number', ''),
    control_number = nullif(p_draft_fields->>'control_number', ''),
    issued_at = nullif(p_draft_fields->>'issued_at', '')::date,
    event_at = nullif(p_draft_fields->>'event_at', '')::date,
    tax_period = nullif(p_draft_fields->>'tax_period', ''),
    tax_half = nullif(p_draft_fields->>'tax_half', '')::smallint,
    period_override_reason = nullif(p_draft_fields->>'period_override_reason', ''),
    affected_document_id = nullif(p_draft_fields->>'affected_document_id', '')::uuid,
    description = p_draft_fields->>'description',
    exempt_cents = (p_draft_fields->>'exempt_cents')::bigint,
    base16_cents = (p_draft_fields->>'base16_cents')::bigint,
    base8_cents = (p_draft_fields->>'base8_cents')::bigint,
    iva_retention_rate = (p_draft_fields->>'iva_retention_rate')::numeric,
    iva_retention_reason = nullif(p_draft_fields->>'iva_retention_reason', ''),
    igtf_applies = (p_draft_fields->>'igtf_applies')::boolean,
    igtf_base_cents = (p_draft_fields->>'igtf_base_cents')::bigint,
    islr_applies = (p_draft_fields->>'islr_applies')::boolean,
    islr_concept_code = nullif(p_draft_fields->>'islr_concept_code', ''),
    islr_base_cents = (p_draft_fields->>'islr_base_cents')::bigint,
    islr_manual_cents = nullif(p_draft_fields->>'islr_manual_cents', '')::bigint,
    islr_manual_reason = nullif(p_draft_fields->>'islr_manual_reason', ''),
    islr_manual_rate = nullif(p_draft_fields->>'islr_manual_rate', '')::numeric,
    islr_manual_subtraction_cents = (p_draft_fields->>'islr_manual_subtraction_cents')::bigint,
    payment_account_label = nullif(p_draft_fields->>'payment_account_label', ''),
    ceco_allocation_note = nullif(p_draft_fields->>'ceco_allocation_note', ''),
    status = 'issued', calculation_snapshot = p_calculation_snapshot,
    settings_snapshot = p_settings_snapshot, accounting_snapshot = p_accounting_snapshot,
    iva_certificate_number = v_iva_number, islr_certificate_number = v_islr_number,
    issued_by = p_actor_id, issued_at_timestamp = now()
  WHERE id = p_document_id;
  RETURN jsonb_build_object('ivaCertificateNumber', v_iva_number, 'islrCertificateNumber', v_islr_number);
END;
$$;
REVOKE ALL ON FUNCTION public.issue_administration_document(uuid, uuid, jsonb, jsonb, jsonb, jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_administration_document(uuid, uuid, jsonb, jsonb, jsonb, jsonb, integer, integer) TO service_role;
