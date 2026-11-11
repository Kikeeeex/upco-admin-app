CREATE TABLE public.fiscal_settings_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  proposal_id uuid NOT NULL REFERENCES public.fiscal_settings_proposals(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  config_snapshot jsonb NOT NULL CHECK (jsonb_typeof(config_snapshot) = 'object'),
  activated_by uuid NOT NULL REFERENCES auth.users(id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (organization_id, proposal_id),
  FOREIGN KEY (organization_id, proposal_id)
    REFERENCES public.fiscal_settings_proposals(organization_id, id)
);

ALTER TABLE public.administration_documents
  ADD COLUMN iva_retention_rate numeric(5,2) NOT NULL DEFAULT 75 CHECK (iva_retention_rate IN (0, 75, 100)),
  ADD COLUMN iva_retention_reason text CHECK (iva_retention_reason IS NULL OR length(btrim(iva_retention_reason)) <= 1000),
  ADD COLUMN islr_manual_rate numeric(7,4) CHECK (islr_manual_rate IS NULL OR (islr_manual_rate >= 0 AND islr_manual_rate <= 100)),
  ADD COLUMN islr_manual_subtraction_cents bigint NOT NULL DEFAULT 0 CHECK (islr_manual_subtraction_cents >= 0);
GRANT INSERT (iva_retention_rate, iva_retention_reason, islr_manual_rate, islr_manual_subtraction_cents)
  ON public.administration_documents TO authenticated;
GRANT UPDATE (iva_retention_rate, iva_retention_reason, islr_manual_rate, islr_manual_subtraction_cents)
  ON public.administration_documents TO authenticated;
CREATE UNIQUE INDEX fiscal_settings_one_active_per_org_idx
  ON public.fiscal_settings_activations(organization_id) WHERE ended_at IS NULL;
CREATE INDEX fiscal_settings_activations_org_version_idx
  ON public.fiscal_settings_activations(organization_id, version_no DESC);

ALTER TABLE public.fiscal_settings_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_settings_activations_admin_read ON public.fiscal_settings_activations FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = fiscal_settings_activations.organization_id
    AND m.user_id = auth.uid() AND m.active AND m.role = 'admin'
));

ALTER TABLE public.fiscal_settings_events DROP CONSTRAINT fiscal_settings_events_action_check;
ALTER TABLE public.fiscal_settings_events ADD CONSTRAINT fiscal_settings_events_action_check
  CHECK (action IN ('proposed', 'activated'));

CREATE FUNCTION public.activate_fiscal_settings_proposal(p_proposal_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_version integer;
  v_config jsonb;
  v_activation uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  SELECT p.organization_id, p.version_no, p.config_values
    INTO v_org, v_version, v_config
  FROM public.fiscal_settings_proposals p
  WHERE p.id = p_proposal_id AND p.status = 'proposed';
  IF v_org IS NULL THEN RAISE EXCEPTION 'proposal unavailable' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id = v_org AND m.user_id = v_user AND m.active AND m.role = 'admin'
  ) THEN RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501'; END IF;

  UPDATE public.fiscal_settings_activations
    SET ended_at = now()
    WHERE organization_id = v_org AND ended_at IS NULL;

  INSERT INTO public.fiscal_settings_activations(
    organization_id, proposal_id, version_no, config_snapshot, activated_by
  ) VALUES (v_org, p_proposal_id, v_version, v_config, v_user)
  RETURNING id INTO v_activation;

  INSERT INTO public.fiscal_settings_events(organization_id, proposal_id, actor_id, action)
    VALUES (v_org, p_proposal_id, v_user, 'activated');

  RETURN v_activation;
END;
$$;

REVOKE ALL ON public.fiscal_settings_activations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_settings_activations TO authenticated;
REVOKE ALL ON FUNCTION public.activate_fiscal_settings_proposal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_fiscal_settings_proposal(uuid) TO authenticated;
