ALTER TABLE public.administration_document_events DROP CONSTRAINT administration_document_events_action_check;
ALTER TABLE public.administration_document_events ADD CONSTRAINT administration_document_events_action_check
  CHECK (action IN ('draft_created', 'draft_updated', 'issued', 'voided', 'historical_import'));

CREATE OR REPLACE FUNCTION public.prepare_administration_document_draft() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft'
    AND NOT (NEW.status = 'issued' AND current_setting('app.administration_historical_import', true) = 'on') THEN
    RAISE EXCEPTION 'documents must be created as drafts or through historical import' USING ERRCODE = '55000';
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
  IF NEW.status = 'issued' THEN
    v_actor := NEW.issued_by;
    v_action := CASE WHEN current_setting('app.administration_historical_import', true) = 'on' THEN 'historical_import' ELSE 'issued' END;
  ELSIF NEW.status = 'voided' THEN v_actor := NEW.voided_by; v_action := 'voided';
  ELSE v_actor := auth.uid(); v_action := CASE WHEN TG_OP = 'INSERT' THEN 'draft_created' ELSE 'draft_updated' END;
  END IF;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'document changes require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.administration_document_events(organization_id, document_id, actor_id, action)
  VALUES (NEW.organization_id, NEW.id, v_actor, v_action);
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.import_administration_documents(
  p_organization_id uuid, p_actor_id uuid, p_settings_snapshot jsonb, p_documents jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_item jsonb;
  v_vendor_id uuid;
  v_document_id uuid;
  v_affected_id uuid;
  v_type text;
  v_number text;
  v_iva_number text;
  v_islr_number text;
  v_count integer := 0;
  v_sequence integer;
  v_settings_id uuid;
  v_settings_version integer;
  v_settings_config jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id = p_organization_id AND m.user_id = p_actor_id AND m.active AND m.role = 'admin'
  ) THEN RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501'; END IF;
  IF p_documents IS NULL OR jsonb_typeof(p_documents) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_documents) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'historical import must contain from 1 to 2000 documents' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_settings_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'fiscal settings snapshot is required' USING ERRCODE = '22023';
  END IF;
  v_settings_id := nullif(p_settings_snapshot->>'activationId', '')::uuid;
  SELECT a.id, a.version_no, a.config_snapshot
    INTO v_settings_id, v_settings_version, v_settings_config
    FROM public.fiscal_settings_activations a
    WHERE a.id = v_settings_id AND a.organization_id = p_organization_id AND a.ended_at IS NULL
    FOR SHARE;
  IF NOT FOUND OR v_settings_version IS DISTINCT FROM (p_settings_snapshot->>'version')::integer
    OR v_settings_config IS DISTINCT FROM p_settings_snapshot->'config' THEN
    RAISE EXCEPTION 'historical import requires the current fiscal settings snapshot' USING ERRCODE = '23514';
  END IF;
  PERFORM set_config('app.administration_historical_import', 'on', true);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_documents) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'historical document row must be an object' USING ERRCODE = '22023';
    END IF;
    v_vendor_id := (v_item->>'fiscal_vendor_id')::uuid;
    v_type := v_item->>'document_type';
    v_number := nullif(btrim(v_item->>'invoice_number'), '');
    IF v_type IS NULL OR v_type NOT IN ('invoice', 'credit_note', 'debit_note') OR v_number IS NULL THEN
      RAISE EXCEPTION 'historical document type or number is invalid' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.fiscal_vendors v WHERE v.id = v_vendor_id AND v.organization_id = p_organization_id
        AND v.active AND v.review_state = 'confirmed'
    ) THEN RAISE EXCEPTION 'historical import requires an active, confirmed fiscal vendor' USING ERRCODE = '23514'; END IF;
    IF nullif(v_item->>'issued_at', '') IS NULL OR nullif(v_item->>'event_at', '') IS NULL
      OR coalesce(v_item->>'tax_period', '') !~ '^\d{4}-(0[1-9]|1[0-2])$'
      OR (v_item->>'tax_half')::smallint NOT IN (1, 2)
      OR (v_item->>'iva_retention_rate')::numeric NOT IN (0, 75, 100) THEN
      RAISE EXCEPTION 'historical document dates, period, half, or IVA rate are invalid' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'calculation_snapshot') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_item->'settings_snapshot') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_item->'accounting_snapshot') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'historical document snapshots are required' USING ERRCODE = '22023';
    END IF;
    v_affected_id := NULL;
    IF v_type <> 'invoice' THEN
      SELECT d.id INTO v_affected_id FROM public.administration_documents d
      WHERE d.organization_id = p_organization_id AND d.fiscal_vendor_id = v_vendor_id AND d.document_type = 'invoice'
        AND d.status = 'issued' AND lower(btrim(d.invoice_number)) = lower(btrim(v_item->>'affected_invoice_number'))
      ORDER BY d.created_at LIMIT 1;
      IF v_affected_id IS NULL THEN RAISE EXCEPTION 'affected invoice is not an issued invoice for this vendor' USING ERRCODE = '23514'; END IF;
    ELSIF nullif(v_item->>'affected_invoice_number', '') IS NOT NULL THEN
      RAISE EXCEPTION 'invoice cannot have an affected invoice' USING ERRCODE = '23514';
    END IF;
    v_iva_number := nullif(v_item->>'iva_certificate_number', '');
    v_islr_number := nullif(v_item->>'islr_certificate_number', '');
    IF v_iva_number IS NOT NULL AND (
      v_iva_number !~ '^\d{14}$' OR left(v_iva_number, 6) <> replace(v_item->>'tax_period', '-', '')
      OR right(v_iva_number, 8)::integer = 0
    ) THEN RAISE EXCEPTION 'original IVA certificate number is invalid' USING ERRCODE = '22023'; END IF;
    IF v_islr_number IS NOT NULL AND (
      v_islr_number !~ '^\d{14}$' OR left(v_islr_number, 6) <> to_char((v_item->>'event_at')::date, 'YYYYMM')
      OR right(v_islr_number, 8)::integer = 0
    ) THEN RAISE EXCEPTION 'original ISLR certificate number is invalid' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.administration_documents(
      organization_id,created_by,fiscal_vendor_id,document_type,invoice_number,control_number,issued_at,event_at,
      tax_period,tax_half,period_override_reason,affected_document_id,description,
      exempt_cents,base16_cents,base8_cents,iva_retention_rate,iva_retention_reason,
      igtf_applies,igtf_base_cents,islr_applies,islr_concept_code,islr_base_cents,
      islr_manual_cents,islr_manual_reason,islr_manual_rate,islr_manual_subtraction_cents,
      payment_account_label,ceco_allocation_note,status,calculation_snapshot,settings_snapshot,accounting_snapshot,
      iva_certificate_number,islr_certificate_number,issued_by,issued_at_timestamp
    ) VALUES (
      p_organization_id,p_actor_id,v_vendor_id,v_type,v_number,nullif(v_item->>'control_number',''),
      (v_item->>'issued_at')::date,(v_item->>'event_at')::date,v_item->>'tax_period',(v_item->>'tax_half')::smallint,
      nullif(v_item->>'period_override_reason',''),v_affected_id,v_item->>'description',
      (v_item->>'exempt_cents')::bigint,(v_item->>'base16_cents')::bigint,(v_item->>'base8_cents')::bigint,
      (v_item->>'iva_retention_rate')::numeric,nullif(v_item->>'iva_retention_reason',''),
      (v_item->>'igtf_applies')::boolean,(v_item->>'igtf_base_cents')::bigint,
      (v_item->>'islr_applies')::boolean,nullif(v_item->>'islr_concept_code',''),(v_item->>'islr_base_cents')::bigint,
      nullif(v_item->>'islr_manual_cents','')::bigint,nullif(v_item->>'islr_manual_reason',''),
      nullif(v_item->>'islr_manual_rate','')::numeric,(v_item->>'islr_manual_subtraction_cents')::bigint,
      nullif(v_item->>'payment_account_label',''),v_item->>'ceco_allocation_note','issued',
      v_item->'calculation_snapshot',p_settings_snapshot,v_item->'accounting_snapshot',
      v_iva_number,v_islr_number,p_actor_id,now()
    ) RETURNING id INTO v_document_id;
    IF v_iva_number IS NOT NULL THEN
      v_sequence := right(v_iva_number, 8)::integer;
      INSERT INTO public.fiscal_certificate_sequences(organization_id,kind,last_number)
      VALUES (p_organization_id,'iva',v_sequence)
      ON CONFLICT (organization_id,kind) DO UPDATE SET last_number = greatest(fiscal_certificate_sequences.last_number, EXCLUDED.last_number),updated_at=now();
    END IF;
    IF v_islr_number IS NOT NULL THEN
      v_sequence := right(v_islr_number, 8)::integer;
      INSERT INTO public.fiscal_certificate_sequences(organization_id,kind,last_number)
      VALUES (p_organization_id,'islr',v_sequence)
      ON CONFLICT (organization_id,kind) DO UPDATE SET last_number = greatest(fiscal_certificate_sequences.last_number, EXCLUDED.last_number),updated_at=now();
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('imported_count',v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.import_administration_documents(uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_administration_documents(uuid,uuid,jsonb,jsonb) TO service_role;
