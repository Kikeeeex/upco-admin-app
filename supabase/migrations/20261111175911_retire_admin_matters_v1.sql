-- Retire the V1 Gestiones feature without deleting its historical records.

CREATE OR REPLACE FUNCTION public.reject_retired_admin_work_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'administration' THEN
    RAISE EXCEPTION 'Administrative matters are retired in Administration V2' USING ERRCODE = '55000';
  ELSIF TG_OP = 'UPDATE' AND (OLD.type = 'administration' OR NEW.type = 'administration') THEN
    RAISE EXCEPTION 'Administrative matters are retired in Administration V2' USING ERRCODE = '55000';
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'administration' THEN
    RAISE EXCEPTION 'Historical administrative matters are retained' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_items_reject_retired_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.reject_retired_admin_work_item();

CREATE OR REPLACE FUNCTION public.reject_retired_admin_related_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Administrative matters and follow-ups are retired in Administration V2' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER admin_details_reject_retired_write
BEFORE INSERT OR UPDATE OR DELETE ON public.admin_details
FOR EACH ROW EXECUTE FUNCTION public.reject_retired_admin_related_write();

CREATE TRIGGER follow_ups_reject_retired_write
BEFORE INSERT OR UPDATE OR DELETE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.reject_retired_admin_related_write();

REVOKE ALL ON FUNCTION public.reject_retired_admin_work_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_retired_admin_related_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_matter(uuid, text, text, text, text, date, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_details, public.follow_ups FROM PUBLIC, anon, authenticated;

DROP POLICY work_items_member_read ON public.work_items;
CREATE POLICY work_items_member_read ON public.work_items FOR SELECT TO authenticated
USING (type <> 'administration' AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active
));

DROP POLICY work_items_member_insert ON public.work_items;
CREATE POLICY work_items_member_insert ON public.work_items FOR INSERT TO authenticated
WITH CHECK (type <> 'administration' AND creator_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active
));

DROP POLICY work_items_member_update ON public.work_items;
CREATE POLICY work_items_member_update ON public.work_items FOR UPDATE TO authenticated
USING (type <> 'administration' AND creator_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active
))
WITH CHECK (type <> 'administration' AND creator_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.organization_id = work_items.organization_id AND m.user_id = auth.uid() AND m.active
));

DROP POLICY activity_log_member_read ON public.activity_log;
CREATE POLICY activity_log_member_read ON public.activity_log FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  JOIN public.work_items item ON item.organization_id = m.organization_id
  WHERE item.id = activity_log.work_item_id AND item.organization_id = activity_log.organization_id
    AND item.type <> 'administration'
    AND m.user_id = auth.uid() AND m.active
));

DROP POLICY activity_log_own_note_insert ON public.activity_log;
CREATE POLICY activity_log_own_note_insert ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (
  action = 'note' AND actor_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.work_items w
    JOIN public.memberships m ON m.organization_id = w.organization_id
      AND m.user_id = auth.uid() AND m.active
    WHERE w.id = activity_log.work_item_id AND w.organization_id = activity_log.organization_id
      AND w.type <> 'administration' AND w.creator_id = auth.uid() AND w.archived_at IS NULL
  )
);
