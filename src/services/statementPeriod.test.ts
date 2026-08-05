// Ujian ringkas tanpa framework — jalankan dengan: npx tsx src/services/statementPeriod.test.ts
import { detectStatementPeriod, applyStatementYear } from "./statementPeriod";

let pass = 0;
let fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : " GAGAL"} ${name}`);
  if (!ok) console.log(`        dapat ${JSON.stringify(got)}, jangka ${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
}

console.log("\ndetectStatementPeriod — format header pelbagai bank:");

check("Maybank, label + colon",
  detectStatementPeriod("MAYBANK ISLAMIC BERHAD\nSTATEMENT DATE : 30/06/25\n30/06 TRANSFER TO A/C 100.00+"),
  { year: "2025", month: 6 });

check("Tiada colon selepas label",
  detectStatementPeriod("PENYATA AKAUN\nSTATEMENT DATE 30/06/2025\n30/06 TRANSFER TO A/C"),
  { year: "2025", month: 6 });

check("Tarikh pada baris berikutnya",
  detectStatementPeriod("TARIKH PENYATA\n30/06/25\n30/06 TRANSFER TO A/C"),
  { year: "2025", month: 6 });

check("Tempoh dua tarikh",
  detectStatementPeriod("PENYATA BAGI 01/06/25 - 30/06/25\n15/06 DUITNOW"),
  { year: "2025", month: 6 });

check("Label + nama bulan",
  detectStatementPeriod("PENYATA BAGI BULAN JUN 2025\n15/06 DUITNOW QR"),
  { year: "2025", month: 6 });

check("Tajuk bulan sahaja",
  detectStatementPeriod("SME FIRST ACCOUNT\nJUN 2025\n15/06 DUITNOW QR"),
  { year: "2025", month: 6 });

check("Tiada header — kira tahun terbanyak (CIMB tarikh penuh)",
  detectStatementPeriod("ACCOUNT TRANSACTIONS\n15/06/2025 PAYMENT 50.00\n16/06/2025 FPX 20.00\n17/06/2025 TRF 10.00"),
  { year: "2025", month: null });

check("Penyata merentas tahun baru",
  detectStatementPeriod("STATEMENT DATE : 31/01/2026\n30/12 TRANSFER FR A/C\n02/01 DUITNOW"),
  { year: "2026", month: 1 });

check("Dokumen kosong — pulangkan null, bukan tahun semasa",
  detectStatementPeriod("TIADA APA-APA DI SINI"),
  { year: null, month: null });

check("Tahun tidak munasabah diabaikan",
  detectStatementPeriod("STATEMENT DATE : 30/06/1998\n30/06 TRANSFER"),
  { year: null, month: null });

console.log("\napplyStatementYear — tulis semula tahun untuk tarikh DD/MM:");

check("Semua transaksi ikut tahun penyata",
  applyStatementYear(
    [{ date: "2026-06-30" }, { date: "2026-06-15" }],
    "2025",
    6
  ),
  [{ date: "2025-06-30" }, { date: "2025-06-15" }]);

check("Bulan lebih lewat dari bulan penyata = tahun sebelumnya",
  applyStatementYear(
    [{ date: "2026-12-30" }, { date: "2026-01-02" }],
    "2026",
    1
  ),
  [{ date: "2025-12-30" }, { date: "2026-01-02" }]);

check("Penyata 12 bulan (Jul 2024 - Jun 2025)",
  applyStatementYear(
    [{ date: "2026-07-05" }, { date: "2026-06-20" }],
    "2025",
    6
  ),
  [{ date: "2024-07-05" }, { date: "2025-06-20" }]);

check("Bulan penyata tidak diketahui — satu tahun sahaja",
  applyStatementYear([{ date: "2026-12-30" }], "2025", null),
  [{ date: "2025-12-30" }]);

check("Tarikh rosak dibiar sahaja",
  applyStatementYear([{ date: "entah" }], "2025", 6),
  [{ date: "entah" }]);

console.log(`\n${pass} lulus, ${fail} gagal\n`);
process.exit(fail > 0 ? 1 : 0);
