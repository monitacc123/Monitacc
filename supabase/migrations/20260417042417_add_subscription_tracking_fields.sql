/*
  # Add Subscription Tracking Fields to Users

  1. Modified Tables
    - `users`
      - `status` (text) - Account status: active, cancelled, expired. Default 'active'
      - `plan_start` (timestamptz) - When the current plan subscription started
      - `plan_end` (timestamptz) - When the current plan subscription ends
      - `referred_by` (text) - Affiliate/referrer code or name
      - `special_id` (text) - Special identifier for affiliates (e.g. AFF-0001)

  2. Notes
    - These fields enable admin to track which users subscribed to which plan
    - plan_start and plan_end allow tracking subscription periods
    - referred_by tracks affiliate referrals
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status text DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'plan_start'
  ) THEN
    ALTER TABLE users ADD COLUMN plan_start timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'plan_end'
  ) THEN
    ALTER TABLE users ADD COLUMN plan_end timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE users ADD COLUMN referred_by text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'special_id'
  ) THEN
    ALTER TABLE users ADD COLUMN special_id text DEFAULT '';
  END IF;
END $$;
