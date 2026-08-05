/*
  # Add Scan Usage Tracking

  ## Purpose
  Track the number of AI scans (receipt + PDF) each user performs per calendar month
  so plan limits can be enforced on the frontend.

  ## New Table
  - `scan_usage`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to users)
    - `scan_type` (text) — 'receipt' | 'pdf'
    - `year_month` (text) — e.g. '2026-04' — partition key for monthly reset
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/insert their own rows
*/

CREATE TABLE IF NOT EXISTS scan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type text NOT NULL DEFAULT 'receipt',
  year_month text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan usage"
  ON scan_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan usage"
  ON scan_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS scan_usage_user_month_idx ON scan_usage(user_id, year_month);
