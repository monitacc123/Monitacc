/*
  ============================================================
  SmartMonitAcc — SKRIP SETUP PANGKALAN DATA UJIAN
  ============================================================

  TUJUAN
  Bina struktur pangkalan data lengkap pada projek Supabase BAHARU
  yang akan digunakan untuk ujian di localhost sahaja.

  CARA GUNA
  1. Buka projek Supabase BAHARU anda (bukan yang live!)
  2. Klik "SQL Editor" di menu kiri
  3. Klik "New query"
  4. Salin SELURUH fail ini, tampal, klik "Run"

  NOTA
  - Skrip ini selamat dijalankan berulang kali (idempotent).
  - Ia menggabungkan kesemua 18 fail migrasi dalam supabase/migrations/
    kepada keadaan AKHIR (bukan main semula sejarah perubahan).
  - JANGAN jalankan skrip ini pada pangkalan data live.
  ============================================================
*/

-- Pastikan fungsi kripto tersedia (untuk gen_random_uuid & crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;


-- ============================================================
-- BAHAGIAN 1: JADUAL UTAMA
-- ============================================================

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text DEFAULT '',
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  company_name text DEFAULT '',
  ssm_number text DEFAULT '',
  business_address text DEFAULT '',
  tax_id text DEFAULT '',
  financial_year_end text DEFAULT '',
  role text DEFAULT 'user',
  plan text DEFAULT 'free',
  status text DEFAULT 'active',
  plan_start timestamptz DEFAULT now(),
  plan_end timestamptz,
  referred_by text DEFAULT '',
  special_id text DEFAULT '',
  special_tier text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ---------- sales ----------
-- Dicipta sebelum records kerana records merujuk kepadanya
CREATE TABLE IF NOT EXISTS sales (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_number text DEFAULT '',
  product_name text DEFAULT '',
  category text DEFAULT 'SALES',
  quantity integer DEFAULT 1,
  price numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  date text NOT NULL,
  customer_name text DEFAULT '',
  payment_method text DEFAULT 'bank',
  reconciled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- ---------- records ----------
CREATE TABLE IF NOT EXISTS records (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  doc_type text DEFAULT '',
  doc_number text DEFAULT '',
  category text DEFAULT '',
  amount numeric(15,2) DEFAULT 0,
  date text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  raw_data text DEFAULT '',
  payment_method text DEFAULT 'bank',
  origin text DEFAULT 'manual',
  sale_id bigint,
  reconciled boolean DEFAULT false,
  remark text DEFAULT '',
  has_image boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Kunci asing records -> sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_records_sale_id'
  ) THEN
    ALTER TABLE records ADD CONSTRAINT fk_records_sale_id
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- opening_balances ----------
-- Baki setiap akaun Kunci Kira-Kira pada hari perniagaan mula guna Monitacc.
-- Semua baris seorang pengguna berkongsi as_at_date yang sama.
CREATE TABLE IF NOT EXISTS opening_balances (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_at_date text NOT NULL,
  category text NOT NULL,
  amount numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT opening_balances_user_category_key UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_opening_balances_user ON opening_balances(user_id);

ALTER TABLE opening_balances ENABLE ROW LEVEL SECURITY;

-- ---------- stock_takes ----------
-- Nilai stok fizikal pada hujung tempoh, digunakan sebagai Stok Akhir dalam COGS.
CREATE TABLE IF NOT EXISTS stock_takes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_at_date text NOT NULL,
  amount numeric(15,2) DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT stock_takes_user_date_key UNIQUE (user_id, as_at_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_takes_user_date ON stock_takes(user_id, as_at_date);

ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;

-- ---------- ai_usage ----------
CREATE TABLE IF NOT EXISTS ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  tokens_used integer DEFAULT 0,
  operation text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- ---------- scan_usage ----------
CREATE TABLE IF NOT EXISTS scan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type text NOT NULL DEFAULT 'receipt',
  year_month text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scan_usage ENABLE ROW LEVEL SECURITY;

-- ---------- affiliates ----------
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


-- ============================================================
-- BAHAGIAN 2: JADUAL STRIPE
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_subscription_status') THEN
    CREATE TYPE stripe_subscription_status AS ENUM (
      'not_started', 'incomplete', 'incomplete_expired', 'trialing',
      'active', 'past_due', 'canceled', 'unpaid', 'paused'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_order_status') THEN
    CREATE TYPE stripe_order_status AS ENUM ('pending', 'completed', 'canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  customer_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id text UNIQUE NOT NULL,
  subscription_id text DEFAULT NULL,
  price_id text DEFAULT NULL,
  current_period_start bigint DEFAULT NULL,
  current_period_end bigint DEFAULT NULL,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_brand text DEFAULT NULL,
  payment_method_last4 text DEFAULT NULL,
  status stripe_subscription_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stripe_orders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  checkout_session_id text NOT NULL,
  payment_intent_id text NOT NULL,
  customer_id text NOT NULL,
  amount_subtotal bigint NOT NULL,
  amount_total bigint NOT NULL,
  currency text NOT NULL,
  payment_status text NOT NULL,
  status stripe_order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- BAHAGIAN 3: INDEKS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_records_user_id      ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_date         ON records(date);
CREATE INDEX IF NOT EXISTS idx_records_type         ON records(type);
CREATE INDEX IF NOT EXISTS idx_sales_user_id        ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date           ON sales(date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id     ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at  ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS scan_usage_user_month_idx ON scan_usage(user_id, year_month);


-- ============================================================
-- BAHAGIAN 4: DASAR KESELAMATAN (RLS)
-- Keadaan AKHIR selepas semua migrasi pembetulan.
-- Nota: semakan admin guna auth.jwt() dan BUKAN subkueri pada
-- jadual users — subkueri menyebabkan rekursi tak terhingga.
-- ============================================================

-- ---------- users ----------
DROP POLICY IF EXISTS "Users can view own profile"   ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admin can view all users"     ON users;
DROP POLICY IF EXISTS "Admin can update all users"   ON users;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admin can update all users"
  ON users FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ---------- records ----------
DROP POLICY IF EXISTS "Users can view own records"   ON records;
DROP POLICY IF EXISTS "Users can insert own records" ON records;
DROP POLICY IF EXISTS "Users can update own records" ON records;
DROP POLICY IF EXISTS "Users can delete own records" ON records;

CREATE POLICY "Users can view own records"
  ON records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records"
  ON records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records"
  ON records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own records"
  ON records FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- opening_balances ----------
DROP POLICY IF EXISTS "Users can view own opening balances"   ON opening_balances;
DROP POLICY IF EXISTS "Users can insert own opening balances" ON opening_balances;
DROP POLICY IF EXISTS "Users can update own opening balances" ON opening_balances;
DROP POLICY IF EXISTS "Users can delete own opening balances" ON opening_balances;

CREATE POLICY "Users can view own opening balances"
  ON opening_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own opening balances"
  ON opening_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own opening balances"
  ON opening_balances FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own opening balances"
  ON opening_balances FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- stock_takes ----------
DROP POLICY IF EXISTS "Users can view own stock takes"   ON stock_takes;
DROP POLICY IF EXISTS "Users can insert own stock takes" ON stock_takes;
DROP POLICY IF EXISTS "Users can update own stock takes" ON stock_takes;
DROP POLICY IF EXISTS "Users can delete own stock takes" ON stock_takes;

CREATE POLICY "Users can view own stock takes"
  ON stock_takes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock takes"
  ON stock_takes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock takes"
  ON stock_takes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock takes"
  ON stock_takes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- sales ----------
DROP POLICY IF EXISTS "Users can view own sales"   ON sales;
DROP POLICY IF EXISTS "Users can insert own sales" ON sales;
DROP POLICY IF EXISTS "Users can update own sales" ON sales;
DROP POLICY IF EXISTS "Users can delete own sales" ON sales;

CREATE POLICY "Users can view own sales"
  ON sales FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales"
  ON sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales"
  ON sales FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales"
  ON sales FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- ai_usage ----------
DROP POLICY IF EXISTS "Users can view own ai usage"             ON ai_usage;
DROP POLICY IF EXISTS "Users can insert own ai usage"           ON ai_usage;
DROP POLICY IF EXISTS "Admins can view all ai usage"            ON ai_usage;
DROP POLICY IF EXISTS "Admins can insert ai usage for any user" ON ai_usage;

CREATE POLICY "Users can view own ai usage"
  ON ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai usage"
  ON ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all ai usage"
  ON ai_usage FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admins can insert ai usage for any user"
  ON ai_usage FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ---------- scan_usage ----------
DROP POLICY IF EXISTS "Users can view own scan usage"   ON scan_usage;
DROP POLICY IF EXISTS "Users can insert own scan usage" ON scan_usage;

CREATE POLICY "Users can view own scan usage"
  ON scan_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scan usage"
  ON scan_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- affiliates ----------
DROP POLICY IF EXISTS "Admin can view affiliates"   ON affiliates;
DROP POLICY IF EXISTS "Admin can insert affiliates" ON affiliates;
DROP POLICY IF EXISTS "Admin can update affiliates" ON affiliates;
DROP POLICY IF EXISTS "Admin can delete affiliates" ON affiliates;

CREATE POLICY "Admin can view affiliates"
  ON affiliates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "Admin can insert affiliates"
  ON affiliates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "Admin can update affiliates"
  ON affiliates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
CREATE POLICY "Admin can delete affiliates"
  ON affiliates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- ---------- stripe ----------
DROP POLICY IF EXISTS "Users can view their own customer data"     ON stripe_customers;
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can view their own order data"        ON stripe_orders;

CREATE POLICY "Users can view their own customer data"
  ON stripe_customers FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

CREATE POLICY "Users can view their own order data"
  ON stripe_orders FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    ) AND deleted_at IS NULL
  );


-- ============================================================
-- BAHAGIAN 5: VIEW STRIPE
-- ============================================================

CREATE OR REPLACE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
  c.customer_id, s.subscription_id, s.status AS subscription_status, s.price_id,
  s.current_period_start, s.current_period_end, s.cancel_at_period_end,
  s.payment_method_brand, s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid() AND c.deleted_at IS NULL AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

CREATE OR REPLACE VIEW stripe_user_orders WITH (security_invoker = true) AS
SELECT
  c.customer_id, o.id AS order_id, o.checkout_session_id, o.payment_intent_id,
  o.amount_subtotal, o.amount_total, o.currency, o.payment_status,
  o.status AS order_status, o.created_at AS order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid() AND c.deleted_at IS NULL AND o.deleted_at IS NULL;

GRANT SELECT ON stripe_user_orders TO authenticated;


-- ============================================================
-- BAHAGIAN 6: STORAGE (bucket gambar resit)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', true, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own receipts"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public can read receipts"      ON storage.objects;

CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public can read receipts"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- BAHAGIAN 7: TRIGGER SEGERAK PERANAN ADMIN
-- Menyalin nilai `role` dari public.users ke JWT app_metadata,
-- supaya dasar RLS admin di atas dapat membacanya.
-- ============================================================

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


-- ============================================================
-- BAHAGIAN 8: AKAUN ADMIN UJIAN
-- ------------------------------------------------------------
-- E-mel    : admin@monitacc.com
-- Kata laluan : Admin@Monitacc2026
--
-- Ini akaun UJIAN pada pangkalan data UJIAN sahaja.
-- Tukar kata laluan di bawah jika mahu.
-- ============================================================

DO $$
DECLARE
  admin_uid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@monitacc.com') THEN
    admin_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud,
      -- Lajur token mesti '' dan bukan NULL, jika tidak log masuk akan gagal
      -- dengan ralat "Database error querying schema".
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'admin@monitacc.com',
      crypt('Admin@Monitacc2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"],"role":"admin"}',
      '{"name":"Admin Monitacc"}',
      now(), now(), 'authenticated', 'authenticated',
      '', '', '', '', ''
    );

    INSERT INTO public.users (
      id, name, email, phone, company_name, role, plan, status, created_at
    ) VALUES (
      admin_uid, 'Admin Monitacc', 'admin@monitacc.com', '',
      'Monitacc HQ', 'admin', 'Ultimate', 'active', now()
    );
  END IF;
END $$;


-- ============================================================
-- SELESAI — semakan akhir
-- ============================================================

SELECT
  'Jadual dicipta' AS semakan,
  count(*)::text AS nilai
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users','records','sales','opening_balances','stock_takes',
    'ai_usage','scan_usage','affiliates',
    'stripe_customers','stripe_subscriptions','stripe_orders'
  )
UNION ALL
SELECT 'Akaun admin', count(*)::text FROM public.users WHERE role = 'admin'
UNION ALL
SELECT 'Bucket receipts', count(*)::text FROM storage.buckets WHERE id = 'receipts';

-- Hasil dijangka:
--   Jadual dicipta   11
--   Akaun admin      1
--   Bucket receipts  1
