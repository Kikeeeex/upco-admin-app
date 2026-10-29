-- BL-15: shared vendor catalog for procurement.
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  contact_name text CHECK (contact_name IS NULL OR length(btrim(contact_name)) BETWEEN 1 AND 200),
  email text CHECK (email IS NULL OR (length(email) <= 254 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  phone text CHECK (phone IS NULL OR length(btrim(phone)) BETWEEN 1 AND 60),
  notes text CHECK (notes IS NULL OR length(btrim(notes)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE UNIQUE INDEX vendors_org_name_key ON public.vendors
  (organization_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
CREATE INDEX vendors_org_name_idx ON public.vendors(organization_id, name, id);

CREATE FUNCTION public.prepare_vendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'immutable vendor fields cannot be changed' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER vendors_prepare BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.prepare_vendor();

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendors_member_read ON public.vendors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active));
CREATE POLICY vendors_member_insert ON public.vendors FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active));
CREATE POLICY vendors_creator_update ON public.vendors FOR UPDATE TO authenticated
USING (created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active))
WITH CHECK (created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active));

REVOKE ALL ON public.vendors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendors TO authenticated;
GRANT INSERT (organization_id, name, contact_name, email, phone, notes, created_by) ON public.vendors TO authenticated;
GRANT UPDATE (name, contact_name, email, phone, notes) ON public.vendors TO authenticated;
REVOKE ALL ON FUNCTION public.prepare_vendor() FROM PUBLIC, anon, authenticated;
