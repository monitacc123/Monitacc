/*
  # Create Admin Account

  Creates a dedicated admin account for the Monitacc system.

  ## Changes
  1. Creates an auth.users entry for the admin
  2. Creates a corresponding users table entry with role = 'admin'

  ## Admin Credentials
  - Email: admin@monitacc.com
  - Password: Admin@Monitacc2026
  - Role: admin
*/

DO $$
DECLARE
  admin_uid uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@monitacc.com'
  ) THEN
    admin_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'admin@monitacc.com',
      crypt('Admin@Monitacc2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Admin Monitacc"}',
      now(),
      now(),
      'authenticated',
      'authenticated'
    );

    INSERT INTO public.users (
      id,
      name,
      email,
      phone,
      company_name,
      role,
      plan,
      status,
      created_at
    ) VALUES (
      admin_uid,
      'Admin Monitacc',
      'admin@monitacc.com',
      '',
      'Monitacc HQ',
      'admin',
      'Ultimate',
      'active',
      now()
    );
  END IF;
END $$;
