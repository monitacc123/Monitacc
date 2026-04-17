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
  payment_method?: 'cash' | 'bank';
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
  payment_method?: 'cash' | 'bank';
}

export type AppView = 'landing' | 'auth' | 'welcome' | 'choose-plan' | 'dashboard' | 'scan' | 'records' | 'reports' | 'profile' | 'plans' | 'sales' | 'ai-analysis' | 'user-management' | 'faq' | 'terms' | 'ledger' | 'reconcile' | 'categories' | 'admin-dashboard' | 'admin-auth' | 'token-usage' | 'affiliated-management' | 'affiliate-auth' | 'affiliate-dashboard' | 'subscription-management';

