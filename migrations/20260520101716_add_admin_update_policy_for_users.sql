/*
  # Add admin UPDATE policy for users table

  ## Summary
  Admin users need to be able to update other users' plan, status, and other fields.
  The existing UPDATE policy only allows users to update their own profile.
  This adds a policy allowing admin to update any user record.

  ## Changes
  - Added UPDATE policy: "Admin can update all users" on `users` table
    - Uses auth.jwt() to check admin role from metadata (avoids recursion)
    - Allows admin to update any user row
*/

CREATE POLICY "Admin can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );