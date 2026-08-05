/*
  # Add has_image flag column to records

  1. Changes
    - Add `has_image` boolean column to `records` table (default false)
    - Mark records that have base64 data URLs with has_image = true
    - This allows lightweight queries to know which records have attachments
      without scanning the large image_url column

  2. Notes
    - The image_url column contains large base64 data (up to 12MB per row)
    - Direct queries on image_url cause statement timeouts
    - This flag enables fast lookups without touching the large data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'has_image'
  ) THEN
    ALTER TABLE records ADD COLUMN has_image boolean DEFAULT false;
  END IF;
END $$;

UPDATE records SET has_image = true WHERE image_url IS NOT NULL AND image_url != '';
