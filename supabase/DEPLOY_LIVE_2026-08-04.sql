/* ============================================================================
   MONITACC — SQL KEMASKINI PANGKALAN DATA LIVE
   Tarikh disediakan: 4 Ogos 2026
   ============================================================================

   APA INI?
   Gabungan 4 migration yang belum dijalankan pada Supabase LIVE:
     1. 20260731000000_allow_public_read_affiliate_names
     2. 20260803000000_add_opening_balances_and_stock_takes
     3. 20260803100000_add_affiliate_referral_links
     4. 20260804000000_add_payment_methods

   CARA GUNA
     1. Buka Supabase Dashboard  >  projek LIVE (bukan projek ujian!)
     2. Menu kiri  >  SQL Editor  >  New query
     3. Salin SELURUH fail ini, tampal, tekan RUN
     4. Tatal ke bawah — jadual semakan akan tunjuk "OK" untuk setiap ciri

   SELAMAT DIJALANKAN BERULANG KALI
     Semua arahan guna IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
     Jika sebahagian sudah wujud, ia dilangkau — bukan error, bukan data hilang.

   TIADA DATA SEDIA ADA DIPADAM
     Fail ini hanya MENAMBAH jadual, lajur, index dan polisi.
     Tiada satu pun arahan DROP TABLE atau DELETE.

   PENTING: URUTAN TIDAK BOLEH DIUBAH
     Bahagian 1 menarik balik kebenaran `anon` pada jadual affiliates,
     Bahagian 3 memberi semula kebenaran itu berserta lajur ref_code.
     Kalau Bahagian 3 dijalankan dahulu, kebenaran akan hilang semula.
   ========================================================================== */


/* ==========================================================================
   BAHAGIAN 0 — SEMAKAN SEBELUM (apa yang sudah ada?)
   ========================================================================== */
SELECT 'SEBELUM' AS peringkat, item, CASE WHEN ada THEN 'sudah ada' ELSE 'belum ada' END AS status
FROM (
  SELECT 'jadual opening_balances' AS item, to_regclass('public.opening_balances') IS NOT NULL AS ada
  UNION ALL SELECT 'jadual stock_takes',      to_regclass('public.stock_takes')      IS NOT NULL
  UNION ALL SELECT 'jadual payment_methods',  to_regclass('public.payment_methods')  IS NOT NULL
  UNION ALL SELECT 'lajur affiliates.ref_code', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='affiliates' AND column_name='ref_code')
) t;


/* ==========================================================================
   BAHAGIAN 1 — Orang awam boleh baca NAMA ejen affiliate sahaja
   Sumber: 20260731000000_allow_public_read_affiliate_names.sql

   Borang pendaftaran (pengguna belum log masuk / peranan `anon`) perlu
   memaparkan senarai ejen dalam dropdown "Rujukan".
   Lajur sensitif (email, phone, bank, account_no, commission) KEKAL tersembunyi.
   ========================================================================== */

-- 1) Tarik balik kebenaran SELECT menyeluruh yang diberi secara lalai kepada `anon`
REVOKE SELECT ON affiliates FROM anon;

-- 2) Beri semula kebenaran SELECT untuk dua lajur tidak sensitif sahaja
GRANT SELECT (id, name) ON affiliates TO anon;

-- 3) Polisi RLS: `anon` hanya nampak ejen berstatus Aktif
DROP POLICY IF EXISTS "Public can view active affiliate names" ON affiliates;

CREATE POLICY "Public can view active affiliate names"
  ON affiliates FOR SELECT
  TO anon
  USING (status = 'Aktif');


/* ==========================================================================
   BAHAGIAN 2 — Baki Awal (Opening Balances) & Stock Take (Stok Akhir)
   Sumber: 20260803000000_add_opening_balances_and_stock_takes.sql

   opening_balances : baki sedia ada perniagaan sebelum guna Monitacc.
   stock_takes      : nilai stok fizikal hujung tempoh, untuk kiraan COGS.
   ========================================================================== */

-- ---------- opening_balances ----------
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


/* ==========================================================================
   BAHAGIAN 3 — Link rujukan unik setiap ejen affiliate
   Sumber: 20260803100000_add_affiliate_referral_links.sql

   Setiap ejen dapat kod unik (cth `hasan`) untuk link
   https://monitacc.com/?ref=hasan
   Kod TIDAK berubah bila nama ejen ditukar — link lama mesti kekal hidup.
   ========================================================================== */

-- 1) Lajur kod rujukan
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS ref_code text;

-- 2) Tukar nama kepada slug: huruf kecil, ruang jadi '-', buang simbol lain
CREATE OR REPLACE FUNCTION affiliate_slugify(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := lower(coalesce(p_name, ''));
  v_slug := replace(v_slug, '''', '');            -- buang apostrof: bin'ali -> binali
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  v_slug := left(v_slug, 40);
  v_slug := regexp_replace(v_slug, '-+$', '', 'g');
  IF v_slug = '' THEN
    v_slug := 'ejen';
  END IF;
  RETURN v_slug;
END;
$$;

-- 3) Jana kod unik. Jika 'hasan' sudah wujud, cuba 'hasan-2', 'hasan-3', ...
CREATE OR REPLACE FUNCTION affiliate_next_ref_code(p_name text, p_exclude_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text := affiliate_slugify(p_name);
  v_code text := v_base;
  v_n integer := 1;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM affiliates
    WHERE ref_code = v_code
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  ) LOOP
    v_n := v_n + 1;
    v_code := v_base || '-' || v_n;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 4) Backfill ejen sedia ada (satu demi satu supaya kod unik dijamin)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id, name FROM affiliates WHERE ref_code IS NULL OR ref_code = '' ORDER BY created_at LOOP
    UPDATE affiliates
    SET ref_code = affiliate_next_ref_code(r.name, r.id)
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Kod mesti unik dan sentiasa ada
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_ref_code_key ON affiliates (ref_code);

-- 6) Trigger: isi kod automatik untuk ejen baru.
--    Kod TIDAK dijana semula bila nama bertukar — link lama mesti kekal hidup.
CREATE OR REPLACE FUNCTION affiliates_fill_ref_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ref_code IS NULL OR trim(NEW.ref_code) = '' THEN
    NEW.ref_code := affiliate_next_ref_code(NEW.name, NEW.id);
  ELSE
    NEW.ref_code := affiliate_slugify(NEW.ref_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS affiliates_set_ref_code ON affiliates;
CREATE TRIGGER affiliates_set_ref_code
  BEFORE INSERT OR UPDATE OF ref_code ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION affiliates_fill_ref_code();

-- 7) Benarkan orang awam membaca kod rujukan (untuk terjemah ?ref=kod -> nama ejen)
GRANT SELECT (id, name, ref_code) ON affiliates TO anon;


/* ==========================================================================
   BAHAGIAN 4 — Kaedah Bayaran Tersuai (e-dompet: TNG, ShopeePay, GrabPay)
   Sumber: 20260804000000_add_payment_methods.sql

   Setiap kaedah jadi satu baris Aset Semasa dalam Kunci Kira-Kira.
   Kod sentiasa berawalan 'pm_' supaya tidak bertembung dengan 'bank'/'cash'.
   ========================================================================== */

CREATE TABLE IF NOT EXISTS payment_methods (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  bs_category text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT payment_methods_user_code_key UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment methods"   ON payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON payment_methods;

CREATE POLICY "Users can view own payment methods"
  ON payment_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment methods"
  ON payment_methods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment methods"
  ON payment_methods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment methods"
  ON payment_methods FOR DELETE TO authenticated USING (auth.uid() = user_id);


/* ==========================================================================
   BAHAGIAN 5 — SEMAKAN SELEPAS
   Semua baris mesti tunjuk "OK". Kalau ada "GAGAL", beritahu saya.
   ========================================================================== */
SELECT 'SELEPAS' AS peringkat, item, CASE WHEN ada THEN 'OK' ELSE 'GAGAL' END AS status
FROM (
  SELECT 'jadual opening_balances' AS item, to_regclass('public.opening_balances') IS NOT NULL AS ada
  UNION ALL SELECT 'jadual stock_takes',       to_regclass('public.stock_takes')      IS NOT NULL
  UNION ALL SELECT 'jadual payment_methods',   to_regclass('public.payment_methods')  IS NOT NULL
  UNION ALL SELECT 'lajur affiliates.ref_code', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='affiliates' AND column_name='ref_code')
  UNION ALL SELECT 'trigger affiliates_set_ref_code', EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='affiliates_set_ref_code')
  UNION ALL SELECT 'polisi awam nama affiliate', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='affiliates' AND policyname='Public can view active affiliate names')
  UNION ALL SELECT 'semua ejen sudah ada ref_code',
    NOT EXISTS (SELECT 1 FROM affiliates WHERE ref_code IS NULL OR ref_code = '')
) t;

-- Senarai kod rujukan setiap ejen (untuk anda kongsi link kepada mereka)
SELECT name AS nama_ejen,
       ref_code AS kod,
       'https://monitacc.com/?ref=' || ref_code AS link_rujukan
FROM affiliates
ORDER BY name;
