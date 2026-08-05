/*
  # Add remark column to records table

  1. Modified Tables
    - `records`
      - Added `remark` (text) - stores purpose/reason for asset/liability transactions (e.g. BANK, CASH IN HAND)

  2. Notes
    - Default value is empty string
    - Used to record the purpose when categories like BANK are selected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'records' AND column_name = 'remark'
  ) THEN
    ALTER TABLE records ADD COLUMN remark text DEFAULT '';
  END IF;
END $$;
