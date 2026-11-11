CREATE FUNCTION public.is_valid_ceco_allocation(p_value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_entry text;
  v_parts text[];
  v_code text;
  v_total numeric := 0;
  v_codes text[] := ARRAY[]::text[];
BEGIN
  IF btrim(p_value) = '' THEN RETURN true; END IF;
  FOREACH v_entry IN ARRAY string_to_array(p_value, ';') LOOP
    v_parts := regexp_match(btrim(v_entry), '^([A-Za-z0-9._-]{1,80}):([0-9]+([.,][0-9]{1,2})?)$');
    IF v_parts IS NULL THEN RETURN false; END IF;
    v_code := upper(v_parts[1]);
    IF v_code = ANY(v_codes) THEN RETURN false; END IF;
    v_codes := array_append(v_codes, v_code);
    IF replace(v_parts[2], ',', '.')::numeric <= 0 THEN RETURN false; END IF;
    v_total := v_total + replace(v_parts[2], ',', '.')::numeric;
  END LOOP;
  RETURN v_total = 100;
END;
$$;

CREATE TABLE public.administration_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  fiscal_vendor_id uuid,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'credit_note', 'debit_note')),
  invoice_number text CHECK (invoice_number IS NULL OR length(btrim(invoice_number)) <= 80),
  control_number text CHECK (control_number IS NULL OR length(btrim(control_number)) <= 80),
  issued_at date,
  event_at date,
  tax_period text CHECK (tax_period IS NULL OR tax_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tax_half smallint CHECK (tax_half IS NULL OR tax_half IN (1, 2)),
  period_override_reason text CHECK (period_override_reason IS NULL OR length(btrim(period_override_reason)) <= 1000),
  affected_document_id uuid,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 2000),
  exempt_cents bigint NOT NULL DEFAULT 0 CHECK (exempt_cents >= 0),
  base16_cents bigint NOT NULL DEFAULT 0 CHECK (base16_cents >= 0),
  base8_cents bigint NOT NULL DEFAULT 0 CHECK (base8_cents >= 0),
  igtf_applies boolean NOT NULL DEFAULT false,
  igtf_base_cents bigint NOT NULL DEFAULT 0 CHECK (igtf_base_cents >= 0),
  islr_applies boolean NOT NULL DEFAULT false,
  islr_concept_code text CHECK (islr_concept_code IS NULL OR length(btrim(islr_concept_code)) <= 80),
  islr_base_cents bigint NOT NULL DEFAULT 0 CHECK (islr_base_cents >= 0),
  islr_manual_cents bigint CHECK (islr_manual_cents IS NULL OR islr_manual_cents >= 0),
  islr_manual_reason text CHECK (islr_manual_reason IS NULL OR length(btrim(islr_manual_reason)) <= 1000),
  payment_account_label text CHECK (payment_account_label IS NULL OR length(btrim(payment_account_label)) <= 200),
  ceco_allocation_note text CHECK (ceco_allocation_note IS NULL OR (length(btrim(ceco_allocation_note)) <= 2000 AND public.is_valid_ceco_allocation(ceco_allocation_note))),
  status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, fiscal_vendor_id) REFERENCES public.fiscal_vendors(organization_id, id),
  FOREIGN KEY (organization_id, affected_document_id) REFERENCES public.administration_documents(organization_id, id),
  CHECK (tax_half IS NULL OR tax_period IS NOT NULL),
  CHECK (NOT islr_applies OR islr_concept_code IS NOT NULL OR islr_manual_cents IS NOT NULL),
  CHECK (NOT islr_applies OR islr_manual_cents IS NULL OR length(btrim(coalesce(islr_manual_reason, ''))) > 0)
);
CREATE INDEX administration_documents_org_created_idx ON public.administration_documents(organization_id, created_at DESC);
CREATE INDEX administration_documents_org_period_idx ON public.administration_documents(organization_id, tax_period, tax_half);
CREATE UNIQUE INDEX administration_documents_unique_vendor_number_idx
  ON public.administration_documents(organization_id, fiscal_vendor_id, document_type, lower(btrim(invoice_number)))
  WHERE fiscal_vendor_id IS NOT NULL AND invoice_number IS NOT NULL AND btrim(invoice_number) <> '';

ALTER TABLE public.administration_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY administration_documents_admin_read ON public.administration_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = administration_documents.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));
CREATE POLICY administration_documents_admin_insert ON public.administration_documents FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND status = 'draft' AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = administration_documents.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));
CREATE POLICY administration_documents_admin_update ON public.administration_documents FOR UPDATE TO authenticated
USING (created_by = auth.uid() AND status = 'draft' AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = administration_documents.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
))
WITH CHECK (created_by = auth.uid() AND status = 'draft' AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = administration_documents.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE TABLE public.administration_document_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  document_id uuid NOT NULL REFERENCES public.administration_documents(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('draft_created', 'draft_updated')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.administration_document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY administration_document_events_admin_read ON public.administration_document_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = administration_document_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE FUNCTION public.prepare_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'Tax issue actions are blocked in Administration V2' USING ERRCODE = '55000';
  END IF;
  IF NEW.affected_document_id IS NOT NULL AND (
    NEW.document_type = 'invoice' OR NEW.fiscal_vendor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.administration_documents affected
      WHERE affected.id = NEW.affected_document_id
        AND affected.organization_id = NEW.organization_id
        AND affected.document_type = 'invoice'
        AND affected.fiscal_vendor_id = NEW.fiscal_vendor_id
    )
  ) THEN
    RAISE EXCEPTION 'affected invoice must belong to the same fiscal vendor' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'document identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.administration_documents note
      WHERE note.affected_document_id = OLD.id
        AND (NEW.document_type <> 'invoice' OR note.fiscal_vendor_id IS DISTINCT FROM NEW.fiscal_vendor_id)
    ) THEN
      RAISE EXCEPTION 'invoice vendor/type cannot change while notes reference it' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER administration_documents_prepare_draft BEFORE INSERT OR UPDATE ON public.administration_documents
FOR EACH ROW EXECUTE FUNCTION public.prepare_administration_document_draft();

CREATE FUNCTION public.audit_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'draft changes require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.administration_document_events(organization_id, document_id, actor_id, action)
  VALUES (NEW.organization_id, NEW.id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'draft_created' ELSE 'draft_updated' END);
  RETURN NULL;
END;
$$;
CREATE TRIGGER administration_documents_audit_draft AFTER INSERT OR UPDATE ON public.administration_documents
FOR EACH ROW EXECUTE FUNCTION public.audit_administration_document_draft();

REVOKE ALL ON public.administration_documents, public.administration_document_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.administration_documents, public.administration_document_events TO authenticated;
GRANT INSERT (organization_id, created_by, fiscal_vendor_id, document_type, invoice_number,
  control_number, issued_at, event_at, tax_period, tax_half, period_override_reason,
  affected_document_id, description, exempt_cents, base16_cents, base8_cents, igtf_applies,
  igtf_base_cents, islr_applies, islr_concept_code, islr_base_cents, islr_manual_cents,
  islr_manual_reason, payment_account_label, ceco_allocation_note, status)
  ON public.administration_documents TO authenticated;
GRANT UPDATE (fiscal_vendor_id, document_type, invoice_number, control_number, issued_at,
  event_at, tax_period, tax_half, period_override_reason, affected_document_id, description,
  exempt_cents, base16_cents, base8_cents, igtf_applies, igtf_base_cents, islr_applies,
  islr_concept_code, islr_base_cents, islr_manual_cents, islr_manual_reason,
  payment_account_label, ceco_allocation_note, status)
  ON public.administration_documents TO authenticated;
REVOKE ALL ON SEQUENCE public.administration_document_events_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_administration_document_draft() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_administration_document_draft() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_valid_ceco_allocation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_ceco_allocation(text) TO authenticated;
