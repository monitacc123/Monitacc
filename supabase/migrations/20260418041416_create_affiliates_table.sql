/*
  # Create affiliates table

  ## Summary
  Creates a dedicated `affiliates` table to store affiliate agent records for the Monitacc admin panel.

  ## New Tables
  - `affiliates`
    - `id` (uuid, primary key)
    - `name` (text) - Agent full name
    - `email` (text, unique) - Agent email
    - `phone` (text) - Agent phone number
    - `bank` (text) - Agent bank name
    - `account_no` (text) - Agent bank account number
    - `referrals` (integer) - Number of referrals made
    - `commission` (numeric) - Total commission earned (RM)
    - `status` (text) - 'Aktif' or 'Tidak Aktif'
    - `is_paid` (boolean) - Whether commission has been paid
    - `joined_date` (date) - Date agent joined
    - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - RLS enabled on `affiliates` table
  - Only admin role can SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  account_no text NOT NULL DEFAULT '',
  referrals integer NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Aktif',
  is_paid boolean NOT NULL DEFAULT false,
  joined_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view affiliates"
  ON affiliates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert affiliates"
  ON affiliates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can update affiliates"
  ON affiliates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can delete affiliates"
  ON affiliates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
