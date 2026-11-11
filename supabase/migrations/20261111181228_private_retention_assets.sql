INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upco-retention-assets', 'upco-retention-assets', false, 1048576, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
