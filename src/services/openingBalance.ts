import type { OpeningBalance, StockTake } from '../types';
import { OPENING_BALANCE_GROUPS, OPENING_BALANCE_SIDE, type OpeningBalanceGroup } from '../constants/categories';
import { CASH_BS_CATEGORY, type PaymentMethod } from '../constants/paymentMethods';

/*
  Pengiraan berkongsi untuk Baki Awal & Stok.

  Kedua-dua Penyata Untung Rugi dan Kunci Kira-Kira mesti guna fungsi yang sama
  di sini — kalau tidak, Untung Terkumpul dalam Kunci Kira-Kira tidak akan padan
  dengan Untung Bersih dalam Untung Rugi dan penyata tidak akan seimbang.
*/

/** Tarikh 'yyyy-MM-dd' -> Date pada penghujung hari itu. */
export function endOfDay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Peta kategori (huruf besar) -> jumlah. */
export function toBalanceMap(balances: OpeningBalance[]): Record<string, number> {
  const map: Record<string, number> = {};
  balances.forEach(b => {
    map[(b.category || '').trim().toUpperCase()] = Number(b.amount) || 0;
  });
  return map;
}

/** Tarikh set baki awal (semua baris berkongsi tarikh yang sama). */
export function openingDate(balances: OpeningBalance[]): string | null {
  return balances.length > 0 ? balances[0].as_at_date : null;
}

/**
 * Adakah baki awal terpakai pada tarikh laporan?
 * Baki awal bertarikh 31/12/2025 tidak sepatutnya muncul dalam laporan
 * yang berakhir 30/11/2025.
 */
export function openingApplies(balances: OpeningBalance[], at: Date): boolean {
  const iso = openingDate(balances);
  if (!iso) return false;
  const d = endOfDay(iso);
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= at.getTime();
}

/**
 * Jumlah baki awal bagi satu set kategori.
 * Kembalikan 0 jika baki awal belum terpakai pada tarikh `at`.
 */
export function openingSum(
  balances: OpeningBalance[],
  categories: string[],
  at: Date,
): number {
  if (!openingApplies(balances, at)) return 0;
  const map = toBalanceMap(balances);
  return categories.reduce((sum, c) => sum + (map[c.trim().toUpperCase()] || 0), 0);
}

/** Baki awal stok (nilai mentah, tanpa semakan tarikh). */
export function rawOpeningStock(balances: OpeningBalance[]): number {
  return toBalanceMap(balances)['STOCK'] || 0;
}

/**
 * Nilai stok yang dibawa pada sesuatu tarikh:
 *   1. Stock take terkini yang bertarikh <= `at`, jika ada
 *   2. Jika tiada, baki awal stok (selagi baki awal sudah terpakai)
 *   3. Jika kedua-dua tiada, 0
 *
 * Sifat penting: nilai ini adalah Stok Akhir bagi tempoh yang berakhir pada
 * `at`, dan serentak menjadi Stok Awal bagi tempoh berikutnya. Kerana itu
 * baris Stok Awal/Stok Akhir saling membatal antara bulan, dan jumlah setahun
 * secara automatik menjadi (Stok Awal Jan - Stok Akhir Dis).
 */
export function stockValueAt(
  balances: OpeningBalance[],
  stockTakes: StockTake[],
  at: Date,
): number {
  const t = at.getTime();

  const applicable = stockTakes
    .filter(s => {
      const d = endOfDay(s.as_at_date);
      return !isNaN(d.getTime()) && d.getTime() <= t;
    })
    .sort((a, b) => endOfDay(a.as_at_date).getTime() - endOfDay(b.as_at_date).getTime());

  if (applicable.length > 0) return Number(applicable[applicable.length - 1].amount) || 0;

  return openingApplies(balances, at) ? rawOpeningStock(balances) : 0;
}

/**
 * Kesan stok ke atas untung terkumpul dari mula perniagaan hingga `at`.
 *
 * Setiap tempoh menambah (Stok Awal - Stok Akhir) kepada COGS. Bila
 * dijumlahkan merentas semua tempoh, nilai pertengahan saling membatal dan
 * tinggal (Stok Awal asal - Stok pada `at`). Kesan ke atas untung ialah
 * songsangnya.
 */
export function cumulativeStockProfitEffect(
  balances: OpeningBalance[],
  stockTakes: StockTake[],
  at: Date,
): number {
  const opening = openingApplies(balances, at) ? rawOpeningStock(balances) : 0;
  return stockValueAt(balances, stockTakes, at) - opening;
}

export interface OpeningBalanceCheck {
  assets: number;       // aset tolak kontra-aset
  liabilities: number;
  equity: number;
  difference: number;   // aset - (liabiliti + ekuiti); mesti 0 untuk seimbang
  isBalanced: boolean;
}

/**
 * Semak set baki awal seimbang: Aset = Liabiliti + Ekuiti.
 * Set yang tidak seimbang akan menyebabkan Kunci Kira-Kira tersasar,
 * jadi borang perlu menghalang pengguna menyimpannya.
 *
 * `extraAssetCategories` untuk kategori yang tiada dalam OPENING_BALANCE_SIDE
 * kerana ia dicipta pengguna semasa larian — iaitu kaedah bayaran tersuai,
 * yang sentiasa berada di sebelah aset.
 */
export function checkOpeningBalances(
  entries: Record<string, number>,
  extraAssetCategories: string[] = [],
): OpeningBalanceCheck {
  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  const extraAssets = new Set(extraAssetCategories.map(c => c.trim().toUpperCase()));

  Object.entries(entries).forEach(([cat, val]) => {
    const amount = Number(val) || 0;
    if (!amount) return;
    const key = cat.trim().toUpperCase();
    if (extraAssets.has(key)) { assets += amount; return; }
    switch (OPENING_BALANCE_SIDE[key]) {
      case 'asset': assets += amount; break;
      case 'contra': assets -= amount; break;
      case 'liab': liabilities += amount; break;
      case 'equity': equity += amount; break;
    }
  });

  const difference = assets - (liabilities + equity);
  return {
    assets,
    liabilities,
    equity,
    difference,
    isBalanced: Math.abs(difference) < 0.005,
  };
}

/** Kategori yang tergolong dalam satu kumpulan borang. */
export function groupCategories(key: string): string[] {
  return OPENING_BALANCE_GROUPS.find(g => g.key === key)?.categories || [];
}

/**
 * Kumpulan borang Baki Awal, dengan kaedah bayaran tersuai pengguna
 * diselitkan ke dalam Aset Semasa sejurus selepas Tunai — supaya baki
 * pembukaan setiap e-dompet boleh dimasukkan sama seperti baki bank & tunai.
 */
export function groupsWithPaymentMethods(methods: PaymentMethod[]): OpeningBalanceGroup[] {
  if (methods.length === 0) return OPENING_BALANCE_GROUPS;
  const extra = methods.map(m => m.bs_category);

  return OPENING_BALANCE_GROUPS.map(g => {
    if (g.key !== 'currentAssets') return g;
    const cats = [...g.categories];
    const at = cats.indexOf(CASH_BS_CATEGORY);
    cats.splice(at === -1 ? cats.length : at + 1, 0, ...extra);
    return { ...g, categories: cats };
  });
}
