-- Notes are immutable activity events. Authenticated users may append notes
-- only to their own active work items; audit events remain trigger-only.
ALTER TABLE public.activity_log
  DROP CONSTRAINT activity_log_action_check,
  ADD CONSTRAINT activity_log_action_check
    CHECK (action IN ('created', 'updated', 'note')),
  ADD CONSTRAINT activity_log_note_body_check
    CHECK (action <> 'note' OR (
      before_values IS NULL
      AND jsonb_typeof(after_values) = 'object'
      AND coalesce(jsonb_typeof(after_values->'body') = 'string', false)
      AND length(btrim(after_values->>'body')) BETWEEN 1 AND 2000
    ));

CREATE POLICY activity_log_own_note_insert ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    action = 'note'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.work_items w
      JOIN public.memberships m ON m.organization_id = w.organization_id
        AND m.user_id = auth.uid() AND m.active
      WHERE w.id = activity_log.work_item_id
        AND w.organization_id = activity_log.organization_id
        AND w.creator_id = auth.uid()
        AND w.archived_at IS NULL
    )
  );

GRANT INSERT (organization_id, work_item_id, action, after_values, actor_id)
  ON public.activity_log TO authenticated;
