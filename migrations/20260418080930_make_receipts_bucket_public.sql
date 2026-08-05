/*
  # Make receipts bucket public

  ## Summary
  Changes the receipts storage bucket from private to public so that
  image URLs (public URLs) work correctly when displaying receipt images
  in the app. Previously the bucket was private which caused "Bucket not found"
  or broken image errors when trying to load images via public URL.

  ## Changes
  - Sets `public = true` on the `receipts` bucket
  - Drops the old per-user SELECT policy
  - Adds a public SELECT policy so anyone with the URL can view files
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'receipts';

DROP POLICY IF EXISTS "Users can read own receipts" ON storage.objects;

CREATE POLICY "Public can read receipts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'receipts');
