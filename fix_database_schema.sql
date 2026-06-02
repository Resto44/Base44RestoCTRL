-- ============================================================
-- Base44RestoCTRL — Comprehensive Database Fix Migration
-- This script ensures all tables required by the application exist
-- and match the expected schema in the frontend.
-- ============================================================

-- 1. Ensure menu_products table exists
CREATE TABLE IF NOT EXISTS menu_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch       TEXT,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  category     TEXT,
  price        NUMERIC DEFAULT 0,
  description  TEXT,
  image_url    TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order   NUMERIC DEFAULT 0,
  addons_json  TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fix products table columns to match Products.jsx
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_id') THEN
        ALTER TABLE products ADD COLUMN product_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='default_price') THEN
        ALTER TABLE products ADD COLUMN default_price NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='default_cost') THEN
        ALTER TABLE products ADD COLUMN default_cost NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='restaurant_id') THEN
        ALTER TABLE products ADD COLUMN restaurant_id UUID;
    END IF;
END $$;

-- 3. Create missing tables mapped in supabaseClient.js
CREATE TABLE IF NOT EXISTS branches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key          TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT, -- e.g., 'product', 'menu', 'expense'
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  branch       TEXT,
  customer_id  UUID,
  status       TEXT DEFAULT 'pending',
  total_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID,
  name         TEXT,
  quantity     NUMERIC DEFAULT 1,
  price        NUMERIC DEFAULT 0,
  total        NUMERIC DEFAULT 0,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  branch       TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  date         DATE,
  time         TEXT,
  guests       INTEGER,
  status       TEXT DEFAULT 'confirmed',
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id),
  amount       NUMERIC DEFAULT 0,
  method       TEXT,
  status       TEXT DEFAULT 'completed',
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  contact_info TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount        NUMERIC NOT NULL,
  description   TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID,
  quantity         NUMERIC DEFAULT 0,
  min_stock_level  NUMERIC DEFAULT 0,
  created_by       TEXT,
  created_date     TIMESTAMPTZ DEFAULT NOW(),
  updated_date     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',
  due_date     TIMESTAMPTZ,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id),
  title        TEXT,
  message      TEXT,
  is_read      BOOLEAN DEFAULT FALSE,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Apply RLS Policies for all tables
DO $$ 
DECLARE 
    t TEXT;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('menu_products', 'branches', 'categories', 'customers', 'orders', 'order_items', 'reservations', 'payments', 'suppliers', 'expenses', 'inventory', 'tasks', 'notifications')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Owner access" ON %I', t);
        EXECUTE format('CREATE POLICY "Owner access" ON %I FOR ALL USING (created_by = (auth.jwt() ->> ''email''))', t);
    END LOOP;
END $$;

-- 5. Special Fix for profiles table RLS
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Ensure handle_new_user trigger is robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
