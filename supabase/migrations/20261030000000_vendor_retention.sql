-- Explicit supplier exception to RN-12: archived vendors can be purged now or after 30 days.
CREATE INDEX vendors_archive_expiry_idx ON public.vendors (archived_at) WHERE archived_at IS NOT NULL;
GRANT DELETE ON public.vendors TO authenticated;

DROP POLICY vendors_member_read ON public.vendors;
CREATE POLICY vendors_member_read ON public.vendors FOR SELECT TO authenticated
USING (
  (archived_at IS NULL OR archived_at >= now() - interval '30 days')
  AND EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active)
);

CREATE POLICY vendors_creator_delete ON public.vendors FOR DELETE TO authenticated
USING (
  archived_at IS NOT NULL AND archived_at >= now() - interval '30 days'
  AND created_by=auth.uid()
  AND EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.organization_id=vendors.organization_id AND m.user_id=auth.uid() AND m.active)
);

CREATE OR REPLACE FUNCTION public.prepare_vendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'immutable vendor fields cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.associated_area IS NULL AND NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'vendor area is required for editing' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived vendor must be restored before editing' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at < now() - interval '30 days' AND NEW.archived_at IS NULL THEN
    RAISE EXCEPTION 'expired archived vendor cannot be restored' USING ERRCODE = '23514';
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF ROW(NEW.name, NEW.associated_area, NEW.contact_name, NEW.email, NEW.phone, NEW.notes)
       IS DISTINCT FROM ROW(OLD.name, OLD.associated_area, OLD.contact_name, OLD.email, OLD.phone, OLD.notes) THEN
      RAISE EXCEPTION 'archive transition cannot edit vendor details' USING ERRCODE = '23514';
    END IF;
    IF NEW.archived_at IS NOT NULL THEN NEW.archived_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.purge_expired_vendors() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE removed_count integer;
BEGIN
  DELETE FROM public.vendors WHERE archived_at < now() - interval '30 days';
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_vendors() FROM PUBLIC, anon, authenticated;

-- pg_cron is available on Supabase. Local PostgreSQL tests skip scheduling when absent.
DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS extensions';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions';
    EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING 'upco_purge_expired_vendors', '* * * * *', 'SELECT public.purge_expired_vendors()';
  END IF;
END;
$schedule$;

NOTIFY pgrst, 'reload schema';
