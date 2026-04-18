/*
  # Fix infinite recursion in users RLS policies

  ## Problem
  The "Admin can view all users" policy used a subquery on the same `users` table,
  causing infinite recursion when any SELECT query was made.

  ## Fix
  - Drop all SELECT policies on `users`
  - Replace with two non-recursive policies:
    1. Users can view their own profile (auth.uid() = id)
    2. Admins can view all users using auth.jwt() to read role from JWT metadata
       instead of querying the users table again
*/

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admin can view all users" ON users;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
