-- Search code and title through one safely parameterized ILIKE column.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.work_items
  ADD COLUMN search_text text GENERATED ALWAYS AS (code || ' ' || title) STORED;

CREATE INDEX work_items_search_text_trgm_idx
  ON public.work_items USING gin (search_text gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
