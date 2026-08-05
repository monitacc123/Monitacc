/*
  # Kaedah Bayaran Tersuai (Custom Payment Methods)

  Tujuan:
    Sebelum ini hanya ada dua kaedah bayaran tetap — 'bank' dan 'cash'. Ramai
    peniaga kecil terima duit melalui e-dompet (Touch 'n Go, ShopeePay, GrabPay),
    dan setiap satu memegang baki yang berasingan daripada bank & tunai.

    Jadual ini membenarkan setiap pengguna menambah kaedah bayarannya sendiri.
    Setiap kaedah menjadi SATU baris Aset Semasa dalam Kunci Kira-Kira, dikira
    sama seperti "Tunai di Tangan": duit masuk menambah baki, duit keluar
    mengurangkannya.

  1. Jadual baharu
    - `payment_methods`
      - `code`  — nilai yang disimpan dalam records.payment_method &
                  sales.payment_method. Sentiasa berawalan 'pm_' supaya tidak
                  bertembung dengan kaedah terbina 'bank' / 'cash'.
      - `label` — nama paparan yang ditaip pengguna (cth "Touch 'n Go eWallet").
      - `bs_category` — nama baris dalam Kunci Kira-Kira & Baki Awal
                  (label dalam huruf besar, cth "TOUCH 'N GO EWALLET").

    Kaedah yang dipadam TIDAK memadam transaksi lama. Transaksi tersebut
    kekal menyimpan kodnya; laporan akan memaparkan kod itu sebagai kaedah
    yang tidak dikenali dan bakinya jatuh semula ke baris Bank.

  2. Keselamatan
    - RLS diaktifkan; pengguna hanya boleh baca/tulis baris miliknya sendiri
*/

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
