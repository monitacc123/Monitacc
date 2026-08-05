/*
  # Benarkan orang awam membaca NAMA ejen affiliate sahaja

  Tujuan:
  Borang pendaftaran (pengguna belum log masuk / peranan `anon`) perlu memaparkan
  senarai ejen berdaftar dalam dropdown "Rujukan", supaya pengguna tidak perlu
  menaip nama secara manual dan komisen sentiasa dipadankan dengan tepat.

  Keselamatan:
  - Akses dibuka kepada peranan `anon` SAHAJA (bukan semua pengguna log masuk).
  - Kebenaran diberi pada PERINGKAT LAJUR: hanya `id` dan `name`.
    Lajur sensitif (email, phone, bank, account_no, commission, referrals)
    KEKAL tersembunyi daripada orang awam.
  - Hanya baris berstatus 'Aktif' dikembalikan (ditapis oleh polisi RLS).
  - Polisi admin sedia ada tidak diubah — admin masih baca semua lajur.
*/

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
