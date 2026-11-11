ALTER TABLE public.administration_documents
  DROP CONSTRAINT administration_documents_status_check,
  ADD CONSTRAINT administration_documents_status_check CHECK (status IN ('draft', 'issued', 'voided')),
  ADD COLUMN void_reason text CHECK (void_reason IS NULL OR length(btrim(void_reason)) BETWEEN 10 AND 1000),
  ADD COLUMN voided_by uuid REFERENCES auth.users(id),
  ADD COLUMN voided_at timestamptz,
  ADD CONSTRAINT administration_documents_void_fields_check CHECK (
    (status = 'voided' AND void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL)
    OR (status <> 'voided' AND void_reason IS NULL AND voided_by IS NULL AND voided_at IS NULL)
  );

ALTER TABLE public.administration_document_events DROP CONSTRAINT administration_document_events_action_check;
ALTER TABLE public.administration_document_events ADD CONSTRAINT administration_document_events_action_check
  CHECK (action IN ('draft_created', 'draft_updated', 'issued', 'voided'));

CREATE OR REPLACE FUNCTION public.prepare_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'documents must be created as drafts' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'voided' THEN
    RAISE EXCEPTION 'voided documents are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'issued' THEN
    IF NEW.status <> 'voided' OR current_setting('app.administration_void', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'issued documents can only be voided through the authorized transaction' USING ERRCODE = '55000';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'void_reason', 'voided_by', 'voided_at']) THEN
      RAISE EXCEPTION 'voiding cannot alter issued fiscal snapshots' USING ERRCODE = '23514';
    END IF;
    IF length(btrim(coalesce(NEW.void_reason, ''))) < 10 OR NEW.voided_by IS NULL THEN
      RAISE EXCEPTION 'voiding requires an actor and documented reason' USING ERRCODE = '23514';
    END IF;
    NEW.voided_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'issued' AND current_setting('app.administration_issue', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'issue only through the authorized transaction' USING ERRCODE = '55000';
  END IF;
  IF NEW.status = 'draft' AND (NEW.calculation_snapshot IS NOT NULL OR NEW.settings_snapshot IS NOT NULL OR NEW.accounting_snapshot IS NOT NULL
    OR NEW.iva_certificate_number IS NOT NULL OR NEW.islr_certificate_number IS NOT NULL OR NEW.issued_by IS NOT NULL OR NEW.issued_at_timestamp IS NOT NULL
    OR NEW.void_reason IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'drafts cannot carry issued or voided fiscal data' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('issued', 'voided') AND (NEW.calculation_snapshot IS NULL OR NEW.settings_snapshot IS NULL OR NEW.accounting_snapshot IS NULL
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
    IF OLD.status <> 'draft' OR NEW.status NOT IN ('draft', 'issued') THEN
      RAISE EXCEPTION 'invalid document status transition' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_action text;
BEGIN
  IF NEW.status = 'issued' THEN v_actor := NEW.issued_by; v_action := 'issued';
  ELSIF NEW.status = 'voided' THEN v_actor := NEW.voided_by; v_action := 'voided';
  ELSE v_actor := auth.uid(); v_action := CASE WHEN TG_OP = 'INSERT' THEN 'draft_created' ELSE 'draft_updated' END;
  END IF;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'document changes require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.administration_document_events(organization_id, document_id, actor_id, action)
  VALUES (NEW.organization_id, NEW.id, v_actor, v_action);
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.void_administration_document(p_document_id uuid, p_actor_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_document public.administration_documents%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.memberships m JOIN public.administration_documents d ON d.organization_id = m.organization_id
    WHERE d.id = p_document_id AND m.user_id = p_actor_id AND m.active AND m.role = 'admin'
  ) THEN RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'void reason must contain between 10 and 1000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_document FROM public.administration_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.status <> 'issued' THEN RAISE EXCEPTION 'only issued documents can be voided' USING ERRCODE = '55000'; END IF;
  PERFORM set_config('app.administration_void', 'on', true);
  UPDATE public.administration_documents
    SET status = 'voided', void_reason = btrim(p_reason), voided_by = p_actor_id, voided_at = now()
    WHERE id = p_document_id;
  -- Certificate numbers are intentionally never released or reused.
END;
$$;

REVOKE ALL ON FUNCTION public.void_administration_document(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_administration_document(uuid, uuid, text) TO service_role;
