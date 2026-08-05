/*
  # Create receipts storage bucket

  ## Summary
  Sets up a Supabase Storage bucket to store receipt images and PDF files
  uploaded by users during the scan/analysis flow. Previously, files were
  stored as base64 strings in the records.image_url column, which bloated
  the database. This migration moves file storage to a dedicated bucket.

  ## Changes
  1. Creates a private storage bucket named `receipts`
  2. Enables RLS on storage.objects for the receipts bucket
  3. Adds policies so authenticated users can:
     - Upload files to their own folder (INSERT)
     - Read their own files (SELECT)
     - Delete their own files (DELETE)

  ## Security
  - Each user's files are stored under `{user_id}/` prefix
  - Policies enforce that users can only access files in their own folder
  - Bucket is private (not public) — access via signed URLs or auth
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
