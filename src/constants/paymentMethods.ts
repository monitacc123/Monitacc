/*
  Kaedah Bayaran (Payment Methods)

  Dua kaedah TERBINA sentiasa wujud dan tidak boleh dipadam:
    'bank' — semua duit yang bergerak melalui akaun bank / online banking
    'cash' — tunai di tangan

  Selain itu pengguna boleh menambah kaedahnya sendiri (cth e-dompet). Setiap
  kaedah tersuai menjadi satu baris Aset Semasa dalam Kunci Kira-Kira, dikira
  cara yang sama seperti tunai.

  Kod kaedah tersuai sentiasa berawalan 'pm_' supaya tidak mungkin bertembung
  dengan 'bank' atau 'cash' walaupun pengguna menamakannya "Bank".
*/

export interface PaymentMethod {
  id?: number;
  code: string;         // disimpan dalam records.payment_method / sales.payment_method
  label: string;        // nama paparan, cth "Touch 'n Go eWallet"
  bs_category: string;  // baris Kunci Kira-Kira & Baki Awal, cth "TOUCH 'N GO EWALLET"
}

export const CUSTOM_METHOD_PREFIX = 'pm_';

export const BANK_METHOD_CODE = 'bank';
export const CASH_METHOD_CODE = 'cash';

/** Kategori Kunci Kira-Kira bagi dua kaedah terbina. */
export const BANK_BS_CATEGORY = 'BANK';
export const CASH_BS_CATEGORY = 'CASH IN HAND';

// Label sengaja dibiarkan pendek — medan ini berkongsi satu baris dengan
// Jumlah & Tarikh serta butang "+", jadi teks panjang akan terpotong.
export const BUILTIN_PAYMENT_METHODS: PaymentMethod[] = [
  { code: BANK_METHOD_CODE, label: 'Bank', bs_category: BANK_BS_CATEGORY },
  { code: CASH_METHOD_CODE, label: 'Tunai', bs_category: CASH_BS_CATEGORY },
];

export function isCustomMethod(code?: string | null): boolean {
  return !!code && code.startsWith(CUSTOM_METHOD_PREFIX);
}

/** "Touch 'n Go eWallet" -> "pm_touch_n_go_ewallet" */
export function methodCodeFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return CUSTOM_METHOD_PREFIX + (slug || 'kaedah');
}

/** "Touch 'n Go eWallet" -> "TOUCH 'N GO EWALLET" (nama baris Kunci Kira-Kira) */
export function methodCategoryFromLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Senarai penuh untuk dropdown: dua kaedah terbina dahulu, kemudian kaedah
 * tersuai pengguna mengikut susunan ia ditambah.
 */
export function allPaymentMethods(custom: PaymentMethod[] = []): PaymentMethod[] {
  return [...BUILTIN_PAYMENT_METHODS, ...custom];
}

/**
 * Nama paparan bagi sesuatu kod. Kod yang tidak dikenali (cth kaedah yang
 * sudah dipadam) jatuh semula kepada "Bank" — sama seperti cara laporan
 * mengira bakinya.
 */
export function paymentMethodLabel(code: string | undefined | null, custom: PaymentMethod[] = []): string {
  if (!code) return 'Bank';
  const found = allPaymentMethods(custom).find(m => m.code === code);
  if (found) return found.label;
  return code === CASH_METHOD_CODE ? 'Tunai' : 'Bank';
}

/** Versi pendek untuk lencana dalam jadual — "Bank / Online" -> "Bank". */
export function paymentMethodShortLabel(code: string | undefined | null, custom: PaymentMethod[] = []): string {
  if (!code || code === BANK_METHOD_CODE) return 'Bank';
  if (code === CASH_METHOD_CODE) return 'Tunai';
  const found = custom.find(m => m.code === code);
  return found ? found.label : 'Bank';
}

/**
 * Sah atau tidak nama kaedah baharu. Kembalikan mesej ralat, atau null jika
 * boleh disimpan.
 */
export function validateNewMethodLabel(label: string, existing: PaymentMethod[]): string | null {
  const trimmed = label.trim();
  if (trimmed.length < 2) return 'Nama kaedah terlalu pendek';
  if (trimmed.length > 40) return 'Nama kaedah terlalu panjang (maksimum 40 huruf)';

  const code = methodCodeFromLabel(trimmed);
  const category = methodCategoryFromLabel(trimmed);

  if (BUILTIN_PAYMENT_METHODS.some(m => m.bs_category === category || m.label.toUpperCase() === category)) {
    return 'Kaedah ini sudah wujud';
  }
  if (existing.some(m => m.code === code || m.bs_category === category)) {
    return 'Kaedah ini sudah wujud';
  }
  return null;
}
