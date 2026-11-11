CREATE TABLE public.fiscal_settings_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  proposal_label text NOT NULL CHECK (length(btrim(proposal_label)) BETWEEN 2 AND 160),
  config_values jsonb NOT NULL CHECK (jsonb_typeof(config_values) = 'object'),
  status text NOT NULL DEFAULT 'proposed' CHECK (status = 'proposed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, version_no),
  UNIQUE (organization_id, id)
);
CREATE INDEX fiscal_settings_proposals_org_version_idx ON public.fiscal_settings_proposals(organization_id, version_no DESC);
ALTER TABLE public.fiscal_settings_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_settings_proposals_admin_read ON public.fiscal_settings_proposals FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_settings_proposals.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));
CREATE POLICY fiscal_settings_proposals_admin_insert ON public.fiscal_settings_proposals FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND status = 'proposed' AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_settings_proposals.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE TABLE public.fiscal_settings_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  proposal_id uuid NOT NULL REFERENCES public.fiscal_settings_proposals(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action = 'proposed'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_settings_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_settings_events_admin_read ON public.fiscal_settings_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_settings_events.organization_id AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

CREATE FUNCTION public.audit_fiscal_settings_proposal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'settings proposals require an authenticated actor' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.fiscal_settings_events(organization_id, proposal_id, actor_id, action)
  VALUES (NEW.organization_id, NEW.id, auth.uid(), 'proposed');
  RETURN NULL;
END;
$$;
CREATE TRIGGER fiscal_settings_proposals_audit AFTER INSERT ON public.fiscal_settings_proposals
FOR EACH ROW EXECUTE FUNCTION public.audit_fiscal_settings_proposal();

REVOKE ALL ON public.fiscal_settings_proposals, public.fiscal_settings_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_settings_proposals, public.fiscal_settings_events TO authenticated;
GRANT INSERT (organization_id, created_by, version_no, proposal_label, config_values, status)
  ON public.fiscal_settings_proposals TO authenticated;
REVOKE ALL ON SEQUENCE public.fiscal_settings_events_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_fiscal_settings_proposal() FROM PUBLIC, anon, authenticated;
