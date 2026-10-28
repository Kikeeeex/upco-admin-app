-- Supabase's Azure identity exposes a tenant claim (custom_claims.tid) and
-- pairwise subject (sub), but not the Entra object ID (oid). Match memberships
-- on that provider-signed subject; retain the object ID as optional audit data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles) OR EXISTS (SELECT 1 FROM public.memberships) THEN
    RAISE EXCEPTION 'backfill existing Azure identities before adding entra_subject';
  END IF;
END;
$$;

ALTER TABLE public.user_profiles
  ALTER COLUMN entra_object_id DROP NOT NULL,
  ADD COLUMN entra_subject text NOT NULL
    CHECK (entra_subject ~ '^[A-Za-z0-9_-]{16,255}$');

ALTER TABLE public.memberships
  ALTER COLUMN entra_object_id DROP NOT NULL,
  ADD COLUMN entra_subject text NOT NULL
    CHECK (entra_subject ~ '^[A-Za-z0-9_-]{16,255}$');

CREATE UNIQUE INDEX user_profiles_tenant_subject_key
  ON public.user_profiles(entra_tenant_id, entra_subject);
CREATE UNIQUE INDEX memberships_org_tenant_subject_key
  ON public.memberships(organization_id, entra_tenant_id, entra_subject);
