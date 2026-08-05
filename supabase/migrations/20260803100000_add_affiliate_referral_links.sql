/*
  # Link rujukan unik untuk setiap ejen affiliate

  Tujuan:
  Setiap ejen mendapat satu KOD RUJUKAN unik (contoh: `hasan`). Kod ini digunakan
  dalam link yang boleh dikongsi — https://monitacc.com/?ref=hasan
  Bila pengguna klik link itu, borang pendaftaran terus mengisi medan "Rujukan"
  dengan nama ejen berkenaan, jadi tiada lagi salah taip nama dan komisen
  sentiasa dipadankan dengan tepat.

  ## Perubahan
  - Lajur baru `affiliates.ref_code` (text, UNIQUE) — kod rujukan setiap ejen
  - Fungsi `affiliate_slugify()` — tukar nama kepada slug selamat-URL
  - Fungsi `affiliate_next_ref_code()` — jana slug unik (tambah -2, -3 jika bertindih)
  - Trigger `affiliates_set_ref_code` — isi kod automatik untuk ejen baru
  - Backfill kod untuk semua ejen sedia ada

  ## Nota penting
  Kod TIDAK berubah bila nama ejen ditukar. Ini disengajakan — link yang sudah
  dikongsi ke WhatsApp/Facebook mesti kekal berfungsi selama-lamanya.

  ## Keselamatan
  - `anon` (pengguna belum log masuk) hanya boleh baca lajur `id`, `name`, `ref_code`
    bagi ejen berstatus 'Aktif' — perlu untuk menterjemah ?ref=kod kepada nama ejen.
  - Lajur sensitif (email, phone, bank, account_no, commission) KEKAL tersembunyi.
*/

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

-- 7) Benarkan orang awam membaca kod rujukan (untuk menterjemah ?ref=kod -> nama ejen).
--    Polisi RLS "Public can view active affiliate names" sedia ada masih terpakai:
--    hanya ejen berstatus 'Aktif' dikembalikan.
GRANT SELECT (id, name, ref_code) ON affiliates TO anon;
