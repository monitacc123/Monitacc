export interface Record {
  id: number;
  accNo?: string;
  docNumber?: string;
  type: 'income' | 'expense';
  docType: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  image_url?: string;
  raw_data?: string;
  created_at: string;
  origin?: 'manual' | 'scan' | 'sale';
  sale_id?: number;
  reconciled?: boolean;
  // 'bank', 'cash', atau kod kaedah tersuai ('pm_...') — lihat constants/paymentMethods
  payment_method?: string;
}

export interface Stats {
  total_income: number;
  total_expense: number;
  byCategory: {
    category: string;
    type: 'income' | 'expense';
    total: number;
  }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  ssm_number?: string;
  business_address?: string;
  tax_id?: string;
  financial_year_end?: string;
  role: string;
  plan: string;
  status?: 'active' | 'cancelled' | 'expired';
  referred_by?: string;
  special_id?: string;
  special_tier?: string;
  plan_start?: string;
  plan_end?: string;
  created_at?: string;
}

export interface Sale {
  id: number;
  accNo?: string;
  docNumber?: string;
  product_name: string;
  category?: string;
  quantity: number;
  price: number;
  total: number;
  date: string;
  customer_name?: string;
  created_at: string;
  reconciled?: boolean;
  payment_method?: string;
}

// Baki awal setiap akaun Kunci Kira-Kira, dibawa masuk sekali sahaja bila
// perniagaan mula guna Monitacc. Semua baris berkongsi as_at_date yang sama.
export interface OpeningBalance {
  id?: number;
  category: string;
  amount: number;
  as_at_date: string;
}

// Nilai stok fizikal pada hujung tempoh — jadi Stok Akhir dalam COGS,
// dan Stok Awal untuk tempoh berikutnya.
export interface StockTake {
  id?: number;
  as_at_date: string;
  amount: number;
  note?: string;
}

export type AppView = 'landing' | 'auth' | 'welcome' | 'choose-plan' | 'dashboard' | 'scan' | 'records' | 'reports' | 'profile' | 'plans' | 'sales' | 'ai-analysis' | 'user-management' | 'faq' | 'terms' | 'ledger' | 'reconcile' | 'categories' | 'opening-balance' | 'admin-dashboard' | 'admin-auth' | 'token-usage' | 'affiliated-management' | 'affiliate-auth' | 'affiliate-dashboard' | 'subscription-management';

