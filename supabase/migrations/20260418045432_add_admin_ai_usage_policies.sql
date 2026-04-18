/*
  # Add admin policies for ai_usage table

  1. Changes
    - Allow admin users to SELECT all ai_usage records (for token usage dashboard)
    - Allow admin users to INSERT ai_usage records for any user (for top-up functionality)
    
  2. Security
    - Admin check via app_metadata role = 'admin'
*/

CREATE POLICY "Admins can view all ai usage"
  ON ai_usage FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can insert ai usage for any user"
  ON ai_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
