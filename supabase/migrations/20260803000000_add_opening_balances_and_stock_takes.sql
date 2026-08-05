/*
  # Baki Awal (Opening Balances) & Stock Take (Stok Akhir)

  Tujuan:
    Perniagaan yang mula guna Monitacc di pertengahan hayat sudah pun ada baki
    sedia ada (bank, tunai, penghutang, stok, aset tetap, pinjaman, modal, dsb).
    Tanpa baki ini, Kunci Kira-Kira hanya memaparkan transaksi yang direkod
    dalam Monitacc sahaja — bukan kedudukan sebenar perniagaan.

  1. Jadual baharu
    - `opening_balances`
      Satu baris per kategori per pengguna. Semua baris berkongsi `as_at_date`
      yang sama (tarikh baki dibawa ke hadapan, biasanya sehari sebelum tahun
      kewangan pertama dalam sistem, cth 31/12/2025).
      Set ini dimasukkan SEKALI sahaja — tahun-tahun berikutnya bergolek
      sendiri kerana Kunci Kira-Kira dikira secara kumulatif.

    - `stock_takes`
      Nilai stok fizikal pada hujung sesuatu tempoh. Digunakan sebagai
      Stok Akhir dalam pengiraan COGS (Stok Awal + Belian - Stok Akhir).
      Stok Akhir bulan N secara automatik menjadi Stok Awal bulan N+1.

  2. Keselamatan
    - RLS diaktifkan pada kedua-dua jadual
    - Pengguna hanya boleh baca/tulis baris miliknya sendiri (auth.uid() = user_id)
*/

-- ============================================================
-- opening_balances
-- ============================================================
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


-- ============================================================
-- stock_takes
-- ============================================================
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
