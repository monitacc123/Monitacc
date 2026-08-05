/*
  # Sync admin role to auth.users app_metadata

  ## Summary
  To avoid recursive RLS policies, admin role must be stored in JWT app_metadata.
  This migration creates a trigger that syncs the `role` field from public.users
  to auth.users.raw_app_meta_data whenever it is inserted or updated.

  ## Changes
  - New function: `sync_user_role_to_auth_metadata()` - copies role to app_metadata
  - New trigger: fires on INSERT or UPDATE of public.users
*/

CREATE OR REPLACE FUNCTION sync_user_role_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_role_change ON users;

CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role_to_auth_metadata();
