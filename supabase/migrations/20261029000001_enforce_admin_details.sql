-- Ensure every newly created ADM work item has its specific detail row.
-- The check is deferred so create_admin_matter can insert both rows atomically.
CREATE FUNCTION public.require_admin_detail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_details WHERE work_item_id = NEW.id) THEN
    RAISE EXCEPTION 'administrative work item requires admin_details' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER work_items_require_admin_detail
AFTER INSERT ON public.work_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW.type = 'administration')
EXECUTE FUNCTION public.require_admin_detail();

REVOKE ALL ON FUNCTION public.require_admin_detail() FROM PUBLIC, anon, authenticated;
