CREATE TABLE public.fiscal_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  source_sequence integer CHECK (source_sequence IS NULL OR source_sequence > 0),
  source_file text CHECK (source_file IS NULL OR length(source_file) <= 200),
  source_row integer CHECK (source_row IS NULL OR source_row > 0),
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 2 AND 200),
  tax_identifier text NOT NULL CHECK (length(btrim(tax_identifier)) BETWEEN 3 AND 40),
  normalized_tax_identifier text GENERATED ALWAYS AS
    (upper(regexp_replace(tax_identifier, '[^[:alnum:]]', '', 'g'))) STORED,
  tax_address text NOT NULL CHECK (length(btrim(tax_address)) BETWEEN 5 AND 1000),
  taxpayer_type text CHECK (taxpayer_type IS NULL OR length(btrim(taxpayer_type)) BETWEEN 1 AND 120),
  person_type text NOT NULL CHECK (person_type IN ('natural', 'legal')),
  residency text CHECK (residency IS NULL OR length(btrim(residency)) BETWEEN 1 AND 80),
  contact_name text CHECK (contact_name IS NULL OR length(btrim(contact_name)) BETWEEN 1 AND 200),
  contact_phone text CHECK (contact_phone IS NULL OR length(btrim(contact_phone)) BETWEEN 1 AND 80),
  contact_email text CHECK (contact_email IS NULL OR length(btrim(contact_email)) BETWEEN 3 AND 254),
  iva_retention_rate numeric(5,2) NOT NULL DEFAULT 75 CHECK (iva_retention_rate IN (0, 75, 100)),
  fiscal_machine_numbers text CHECK (fiscal_machine_numbers IS NULL OR length(fiscal_machine_numbers) <= 2000),
  active boolean NOT NULL DEFAULT true,
  review_state text NOT NULL DEFAULT 'needs_review' CHECK (review_state IN ('needs_review', 'confirmed')),
  procurement_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  review_notes text CHECK (review_notes IS NULL OR length(review_notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(normalized_tax_identifier) BETWEEN 3 AND 40),
  UNIQUE (organization_id, normalized_tax_identifier),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX fiscal_vendors_org_procurement_link_key
  ON public.fiscal_vendors(organization_id, procurement_vendor_id)
  WHERE procurement_vendor_id IS NOT NULL;
CREATE INDEX fiscal_vendors_org_name_idx ON public.fiscal_vendors(organization_id, lower(legal_name));

ALTER TABLE public.fiscal_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_vendors_admin_read ON public.fiscal_vendors FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_vendors.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));
CREATE POLICY fiscal_vendors_owner_insert ON public.fiscal_vendors FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND procurement_vendor_id IS NULL AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_vendors.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));
CREATE POLICY fiscal_vendors_owner_update ON public.fiscal_vendors FOR UPDATE TO authenticated
USING (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_vendors.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
))
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_vendors.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE TABLE public.fiscal_vendor_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  fiscal_vendor_id uuid NOT NULL REFERENCES public.fiscal_vendors(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('created', 'updated')),
  before_values jsonb,
  after_values jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fiscal_vendor_events_record_time_idx ON public.fiscal_vendor_events(fiscal_vendor_id, occurred_at DESC);
ALTER TABLE public.fiscal_vendor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_vendor_events_admin_read ON public.fiscal_vendor_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_vendor_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE FUNCTION public.prepare_fiscal_vendor() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.source_sequence IS DISTINCT FROM OLD.source_sequence
      OR NEW.source_file IS DISTINCT FROM OLD.source_file OR NEW.source_row IS DISTINCT FROM OLD.source_row THEN
      RAISE EXCEPTION 'fiscal vendor identity and provenance are immutable' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := now();
  END IF;
  IF NEW.procurement_vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Procura link requires a separate reviewed operation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fiscal_vendors_prepare BEFORE INSERT OR UPDATE ON public.fiscal_vendors
FOR EACH ROW EXECUTE FUNCTION public.prepare_fiscal_vendor();

CREATE FUNCTION public.audit_fiscal_vendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'fiscal vendor changes require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.fiscal_vendor_events(organization_id, fiscal_vendor_id, actor_id, action, before_values, after_values)
  VALUES (NEW.organization_id, NEW.id, actor, CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
      'legal_name', OLD.legal_name, 'tax_identifier', OLD.tax_identifier, 'tax_address', OLD.tax_address,
      'person_type', OLD.person_type, 'taxpayer_type', OLD.taxpayer_type, 'residency', OLD.residency,
      'iva_retention_rate', OLD.iva_retention_rate, 'active', OLD.active, 'review_state', OLD.review_state
    ) ELSE NULL END,
    jsonb_build_object(
      'legal_name', NEW.legal_name, 'tax_identifier', NEW.tax_identifier, 'tax_address', NEW.tax_address,
      'person_type', NEW.person_type, 'taxpayer_type', NEW.taxpayer_type, 'residency', NEW.residency,
      'iva_retention_rate', NEW.iva_retention_rate, 'active', NEW.active, 'review_state', NEW.review_state
    ));
  RETURN NULL;
END;
$$;
CREATE TRIGGER fiscal_vendors_audit AFTER INSERT OR UPDATE ON public.fiscal_vendors
FOR EACH ROW EXECUTE FUNCTION public.audit_fiscal_vendor();

REVOKE ALL ON public.fiscal_vendors, public.fiscal_vendor_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_vendors TO authenticated;
GRANT INSERT (organization_id, created_by, legal_name, tax_identifier, tax_address, taxpayer_type,
  person_type, residency, contact_name, contact_phone, contact_email, iva_retention_rate,
  fiscal_machine_numbers, active, review_state, review_notes) ON public.fiscal_vendors TO authenticated;
GRANT UPDATE (legal_name, tax_identifier, tax_address, taxpayer_type, person_type, residency,
  contact_name, contact_phone, contact_email, iva_retention_rate, fiscal_machine_numbers,
  active, review_state, review_notes) ON public.fiscal_vendors TO authenticated;
GRANT SELECT ON public.fiscal_vendor_events TO authenticated;
REVOKE ALL ON SEQUENCE public.fiscal_vendor_events_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_fiscal_vendor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_fiscal_vendor() FROM PUBLIC, anon, authenticated;
