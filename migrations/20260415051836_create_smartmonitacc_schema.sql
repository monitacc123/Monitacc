/*
  # SmartMonitAcc Schema

  ## Overview
  Initial schema for the SmartMonitAcc business accounting application.

  ## New Tables

  ### users
  - Extended profile table linked to Supabase Auth
  - Stores business info: company_name, ssm_number, business_address, tax_id, financial_year_end
  - Stores contact info: name, phone
  - Stores role and plan for access control

  ### records
  - Income and expense transaction records
  - Linked to users via user_id
  - Supports AI-scanned documents (image_url, raw_data)
  - Tracks reconciliation status
  - Links to sales via sale_id

  ### sales
  - Sales/invoice records
  - Linked to users via user_id
  - Tracks product, quantity, price, customer

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
*/

-- Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text DEFAULT '',
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  company_name text DEFAULT '',
  ssm_number text DEFAULT '',
  business_address text DEFAULT '',
  tax_id text DEFAULT '',
  financial_year_end text DEFAULT '',
  role text DEFAULT 'user',
  plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Records table (income & expense transactions)
CREATE TABLE IF NOT EXISTS records (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  doc_type text DEFAULT '',
  doc_number text DEFAULT '',
  category text DEFAULT '',
  amount numeric(15,2) DEFAULT 0,
  date text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  raw_data text DEFAULT '',
  payment_method text DEFAULT 'bank',
  origin text DEFAULT 'manual',
  sale_id bigint,
  reconciled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records"
  ON records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
  ON records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records"
  ON records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own records"
  ON records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Sales table (invoices/sales records)
CREATE TABLE IF NOT EXISTS sales (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_number text DEFAULT '',
  product_name text DEFAULT '',
  category text DEFAULT 'SALES',
  quantity integer DEFAULT 1,
  price numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  date text NOT NULL,
  customer_name text DEFAULT '',
  payment_method text DEFAULT 'bank',
  reconciled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sales"
  ON sales FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales"
  ON sales FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add foreign key from records to sales
ALTER TABLE records ADD CONSTRAINT fk_records_sale_id 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
