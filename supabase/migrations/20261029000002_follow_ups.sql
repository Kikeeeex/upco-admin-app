-- BL-14: follow-ups linked to administrative matters.
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id),
  scheduled_for date NOT NULL,
  contact_name text NOT NULL CHECK (length(btrim(contact_name)) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  outcome text CHECK (outcome IS NULL OR length(btrim(outcome)) BETWEEN 1 AND 2000),
  performed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pending' AND outcome IS NULL AND performed_at IS NULL)
      OR (status = 'done' AND outcome IS NOT NULL AND performed_at IS NOT NULL))
);
CREATE INDEX follow_ups_agenda_idx ON public.follow_ups(status, scheduled_for, work_item_id);

CREATE FUNCTION public.prepare_admin_follow_up() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE parent_type text;
BEGIN
  SELECT type INTO parent_type FROM public.work_items WHERE id = NEW.work_item_id;
  IF parent_type IS DISTINCT FROM 'administration' THEN
    RAISE EXCEPTION 'follow-up requires an administrative matter' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.work_item_id IS DISTINCT FROM OLD.work_item_id OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.contact_name IS DISTINCT FROM OLD.contact_name OR NEW.reason IS DISTINCT FROM OLD.reason
      OR OLD.status = 'done' THEN
      RAISE EXCEPTION 'follow-up identity or completed record cannot change' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'done' THEN
    IF NEW.outcome IS NULL OR btrim(NEW.outcome) = '' THEN
      RAISE EXCEPTION 'completed follow-up requires outcome' USING ERRCODE = '23514';
    END IF;
    NEW.performed_at := now();
  ELSE
    NEW.outcome := NULL;
    NEW.performed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER follow_ups_prepare BEFORE INSERT OR UPDATE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.prepare_admin_follow_up();

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY follow_ups_member_read ON public.follow_ups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.work_items item WHERE item.id = follow_ups.work_item_id AND item.type = 'administration'));
CREATE POLICY follow_ups_owner_insert ON public.follow_ups FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.work_items item WHERE item.id = follow_ups.work_item_id
    AND item.type = 'administration' AND item.creator_id = auth.uid() AND item.archived_at IS NULL));
CREATE POLICY follow_ups_owner_update ON public.follow_ups FOR UPDATE TO authenticated
USING (created_by = auth.uid() AND status = 'pending' AND EXISTS (
  SELECT 1 FROM public.work_items item WHERE item.id = follow_ups.work_item_id
    AND item.type = 'administration' AND item.creator_id = auth.uid() AND item.archived_at IS NULL))
WITH CHECK (created_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.work_items item WHERE item.id = follow_ups.work_item_id
    AND item.type = 'administration' AND item.creator_id = auth.uid() AND item.archived_at IS NULL));

REVOKE ALL ON public.follow_ups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.follow_ups TO authenticated;
GRANT INSERT (work_item_id, scheduled_for, contact_name, reason, created_by) ON public.follow_ups TO authenticated;
GRANT UPDATE (scheduled_for, status, outcome) ON public.follow_ups TO authenticated;

CREATE FUNCTION public.audit_admin_follow_up() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE parent_organization uuid;
BEGIN
  SELECT organization_id INTO parent_organization FROM public.work_items WHERE id = NEW.work_item_id;
  INSERT INTO public.activity_log(organization_id, work_item_id, action, before_values, after_values, actor_id)
  VALUES (parent_organization, NEW.work_item_id, 'updated',
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('follow_up_id', OLD.id,
      'follow_up_status', OLD.status, 'follow_up_date', OLD.scheduled_for) ELSE NULL END,
    jsonb_build_object('follow_up_id', NEW.id, 'follow_up_status', NEW.status,
      'follow_up_date', NEW.scheduled_for, 'follow_up_outcome', NEW.outcome), auth.uid());
  RETURN NULL;
END;
$$;
CREATE TRIGGER follow_ups_audit AFTER INSERT OR UPDATE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_follow_up();
REVOKE ALL ON FUNCTION public.prepare_admin_follow_up() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_admin_follow_up() FROM PUBLIC, anon, authenticated;
