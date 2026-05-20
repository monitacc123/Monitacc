/*
  # Add special_tier column to users

  1. Modified Tables
    - `users`
      - `special_tier` (text) - Stores the tier level (Starter/Growth/Ultimate) for users on the Special plan

  2. Notes
    - This allows admin to assign a Special (non-subscription) package with a specific tier level
    - The special_tier determines what features the user can access
    - Combined with plan_end, this creates a flexible prepaid/gifted access model
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'special_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN special_tier text DEFAULT '';
  END IF;
END $$;