/*
  # Add admin SELECT policy for users table

  ## Summary
  The existing RLS policy on the `users` table only allows users to view their own record.
  This migration adds a policy that allows admin users to read ALL user records,
  which is required for the Admin Dashboard to display correct statistics and user lists.

  ## Changes
  - Added SELECT policy: "Admin can view all users" on `users` table
    - Allows any authenticated user with role = 'admin' to read all rows
*/

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS me
      WHERE me.id = auth.uid()
      AND me.role = 'admin'
    )
    OR auth.uid() = id
  );
