-- A vendor belongs to one existing work area. Removing it from the catalog is reversible.
ALTER TABLE public.vendors ADD COLUMN associated_area text NOT NULL DEFAULT 'procurement'
  CONSTRAINT vendors_associated_area_check CHECK (associated_area IN ('general', 'administration', 'procurement', 'it'));
ALTER TABLE public.vendors ADD COLUMN archived_at timestamptz;
CREATE INDEX vendors_org_archived_idx ON public.vendors (organization_id, archived_at DESC, id)
  WHERE archived_at IS NOT NULL;

GRANT INSERT (associated_area) ON public.vendors TO authenticated;
GRANT UPDATE (associated_area, archived_at) ON public.vendors TO authenticated;

CREATE OR REPLACE FUNCTION public.prepare_vendor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'immutable vendor fields cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived vendor must be restored before editing' USING ERRCODE = '23514';
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
