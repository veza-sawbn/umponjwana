-- Visit Drakensberg — seed test users
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- All accounts use password: Test1234!

-- Helper function to create a test user and set their profile
CREATE OR REPLACE FUNCTION create_test_user(
  p_email        text,
  p_full_name    text,
  p_role         text,
  p_approved     boolean DEFAULT false,
  p_supplier_type text DEFAULT null
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Create auth user (email pre-confirmed, no email sending)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    is_super_admin, confirmation_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt('Test1234!', gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role,
      'supplier_type', p_supplier_type
    ),
    '{"provider":"email","providers":["email"]}'::jsonb,
    false,
    ''
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('Test1234!', gen_salt('bf')),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role,
      'supplier_type', p_supplier_type
    )
  RETURNING id INTO v_user_id;

  -- If ON CONFLICT updated, get the existing id
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  END IF;

  -- Upsert profile
  INSERT INTO profiles (id, full_name, email, role, is_approved)
  VALUES (v_user_id, p_full_name, p_email, p_role::user_role, p_approved)
  ON CONFLICT (id) DO UPDATE SET
    full_name   = p_full_name,
    role        = p_role::user_role,
    is_approved = p_approved;
END;
$$;

-- ── Create test accounts ────────────────────────────────────────────────────
SELECT create_test_user('visitor@test.vd',    'Sam Visitor',             'visitor', false);
SELECT create_test_user('admin@test.vd',      'Admin User',              'admin',   true);
SELECT create_test_user('stays@test.vd',      'Mountain Lodge Co.',      'supplier', true,  'Accommodation');
SELECT create_test_user('activity@test.vd',   'Berg Activities Ltd.',    'supplier', true,  'Activity');
SELECT create_test_user('tours@test.vd',      'Peak Guides Collective',  'supplier', true,  'Guided Tours');
SELECT create_test_user('shuttle@test.vd',    'Berg Transfers',          'supplier', true,  'Shuttle');
SELECT create_test_user('experience@test.vd', 'Drakensberg Experiences', 'supplier', true,  'Experience');
SELECT create_test_user('pending@test.vd',    'New Supplier (Pending)',   'supplier', false, 'Accommodation');

-- Clean up helper
DROP FUNCTION create_test_user;

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT u.email, p.role, p.is_approved,
       (u.raw_user_meta_data->>'supplier_type') AS supplier_type
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%@test.vd'
ORDER BY p.role, u.email;
