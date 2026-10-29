-- Preserve the applied BL-15 migration and tighten database validation.
ALTER TABLE public.vendors DROP CONSTRAINT vendors_name_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_name_check
CHECK (length(name) <= 200 AND length(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) >= 1);

DROP INDEX public.vendors_org_name_key;
CREATE UNIQUE INDEX vendors_org_name_key ON public.vendors
  (organization_id, lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))));

ALTER TABLE public.vendors DROP CONSTRAINT vendors_email_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_email_check
CHECK (email IS NULL OR (length(email) <= 254
  AND email ~ '^[A-Za-z0-9_''+.-]*[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*[.])+[A-Za-z]{2,}$'
  AND email !~ '^[.]' AND email !~ '[.][.]'));
