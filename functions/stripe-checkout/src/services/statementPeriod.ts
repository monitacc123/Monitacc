// Pengesanan tarikh penyata bank.
//
// Diasingkan daripada geminiService supaya ia bebas daripada Supabase/AI dan
// boleh diuji sendiri (lihat statementPeriod.test.ts).

// Label header yang digunakan bank Malaysia untuk tarikh/tempoh penyata.
const STATEMENT_LABEL =
  String.raw`(?:STATEMENT\s*(?:DATE|PERIOD|FOR|FROM)|DATE\s*OF\s*STATEMENT|TARIKH\s*PENYATA|PENYATA\s*(?:BAGI|BULAN|SEHINGGA)|TEMPOH\s*PENYATA|ACCOUNT\s*STATEMENT|PENYATA\s*AKAUN)`;

const MONTH_WORDS: Record<string, number> = {
  jan: 1, feb: 2, mac: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, ogo: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dis: 12, dec: 12,
};

/**
 * Kesan tempoh penyata (tahun + bulan) daripada teks PDF.
 *
 * Penyata bank Malaysia menulis tarikh header dengan pelbagai cara:
 * "STATEMENT DATE : 30/06/25", "TARIKH PENYATA 30/06/2025",
 * "PENYATA BAGI BULAN JUN 2025", dan ada yang meletakkan tarikh pada baris
 * berikutnya tanpa titik bertindih. Versi lama hanya cuba SATU corak
 * ("STATEMENT DATE...:") — bila corak itu tidak sepadan, sistem jatuh ke
 * tahun semasa. Itulah sebab penyata Jun 2025 direkod sebagai Jun 2026.
 *
 * Sekarang kita cuba beberapa corak, kemudian jatuh balik kepada tahun yang
 * PALING KERAP muncul dalam dokumen. Tahun semasa hanya digunakan sebagai
 * pilihan terakhir apabila dokumen benar-benar tiada sebarang tahun.
 */
export function detectStatementPeriod(text: string): { year: string | null; month: number | null } {
  const thisYear = new Date().getFullYear();
  const expand = (y: string) => (y.length === 2 ? `20${y}` : y);
  // Tahun penyata mustahil sebelum 2000 atau lebih setahun ke hadapan.
  const sane = (y: string): string | null => {
    const n = parseInt(y, 10);
    return n >= 2000 && n <= thisYear + 1 ? String(n) : null;
  };

  // 1. Label + tarikh berangka, cth "STATEMENT DATE : 30/06/25"
  for (const m of text.matchAll(
    new RegExp(`${STATEMENT_LABEL}[^0-9]{0,40}(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{2,4})`, "gi")
  )) {
    const year = sane(expand(m[3]));
    if (year) return { year, month: parseInt(m[2], 10) };
  }

  // 2. Label + nama bulan, cth "PENYATA BAGI BULAN JUN 2025"
  for (const m of text.matchAll(
    new RegExp(`${STATEMENT_LABEL}[^A-Za-z0-9]{0,20}([A-Za-z]{3,9})[^0-9]{0,6}(\\d{4})`, "gi")
  )) {
    const month = MONTH_WORDS[m[1].slice(0, 3).toLowerCase()];
    const year = sane(m[2]);
    if (month && year) return { year, month };
  }

  // 3. Nama bulan + tahun dalam kawasan header, cth "JUN 2025" pada tajuk.
  //    Dihadkan kepada bahagian awal dokumen supaya tarikh dalam nota kaki
  //    atau teks undang-undang di hujung penyata tidak tersalah ambil.
  const header = text.slice(0, 3000);
  for (const m of header.matchAll(/\b([A-Za-z]{3,9})\s+(\d{4})\b/g)) {
    const month = MONTH_WORDS[m[1].slice(0, 3).toLowerCase()];
    const year = month ? sane(m[2]) : null;
    if (month && year) return { year, month };
  }

  // 4. Tiada header dikenali — ambil tahun paling kerap daripada semua
  //    tarikh penuh dalam dokumen (biasanya tarikh transaksi itu sendiri).
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\b\d{1,2}[\/.-]\d{1,2}[\/.-](\d{2}|\d{4})\b/g)) {
    const year = sane(expand(m[1]));
    if (year) counts.set(year, (counts.get(year) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [year, count] of counts) {
    if (count > bestCount) { best = year; bestCount = count; }
  }
  return { year: best, month: null };
}

/**
 * Tetapkan tahun sebenar untuk penyata yang tarikh transaksinya hanya DD/MM
 * (cth Maybank). Tahun yang dikeluarkan AI untuk penyata sebegini adalah
 * tekaan daripada prompt kita, jadi ia ditulis semula dengan tahun penyata.
 *
 * Bila bulan penyata diketahui, transaksi yang bulannya LEBIH LEWAT daripada
 * bulan penyata mesti datang dari tahun sebelumnya — penyata tidak mungkin
 * mengandungi transaksi selepas tarikhnya sendiri. Ini membetulkan penyata
 * yang merentas tahun baru (cth penyata Januari yang ada baris 30/12).
 */
export function applyStatementYear<T extends { date: string }>(
  txs: T[],
  statementYear: string,
  statementMonth: number | null
): T[] {
  return txs.map(tx => {
    const parts = String(tx.date || "").split("-");
    if (parts.length !== 3) return tx;
    const month = parseInt(parts[1], 10);
    if (!month || month < 1 || month > 12) return tx;
    let year = parseInt(statementYear, 10);
    if (statementMonth && month > statementMonth) year -= 1;
    return { ...tx, date: `${year}-${parts[1]}-${parts[2]}` };
  });
}
