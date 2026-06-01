-- ============================================================
-- Restaurant Manager Pro — Final Supabase Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Helper: auto-update updated_date ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── PROFILES (linked to auth.users) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  role          TEXT DEFAULT 'admin', -- 'admin', 'manager', 'cashier', 'waiter'
  branch        TEXT, -- String key for branch
  restaurant_id UUID,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── RESTAURANTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL, -- Owner's email
  name         TEXT NOT NULL,
  logo_url     TEXT,
  address      TEXT,
  currency     TEXT DEFAULT '$',
  timezone     TEXT DEFAULT 'UTC',
  is_active    BOOLEAN DEFAULT TRUE,
  branches     JSONB DEFAULT '[]', -- JSON array of {key, label, manager_email, is_active}
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- ── BRANCHES (New Table) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_key    TEXT NOT NULL, -- Unique string key per restaurant
  name          TEXT NOT NULL,
  location      TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, branch_key)
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- ── CATEGORIES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL, -- 'product', 'expense', 'purchase', 'menu'
  icon         TEXT,
  color        TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ── PRODUCTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES categories(id),
  product_id   TEXT, -- Legacy SKU/Code
  name         TEXT NOT NULL,
  name_ar      TEXT,
  description  TEXT,
  default_price NUMERIC DEFAULT 0,
  default_cost  NUMERIC DEFAULT 0,
  unit         TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ── INVENTORY ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch           TEXT NOT NULL, -- Matches app's 'branch' string field
  product_id       TEXT NOT NULL, -- Matches app's 'product_id' string field
  product_name     TEXT,
  quantity         NUMERIC DEFAULT 0,
  opening_stock    NUMERIC DEFAULT 0,
  low_stock_threshold NUMERIC DEFAULT 5,
  unit             TEXT,
  date             DATE DEFAULT CURRENT_DATE,
  last_updated     TIMESTAMPTZ DEFAULT NOW(),
  created_by       TEXT,
  created_date     TIMESTAMPTZ DEFAULT NOW(),
  updated_date     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ── SUPPLIERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ── CUSTOMERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ── DAILY SALES (Existing Table compatibility) ──────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch        TEXT NOT NULL,
  date          DATE NOT NULL,
  restaurant_cash NUMERIC DEFAULT 0,
  restaurant_network NUMERIC DEFAULT 0,
  credit        NUMERIC DEFAULT 0,
  cash          NUMERIC DEFAULT 0, -- Legacy support
  network       NUMERIC DEFAULT 0, -- Legacy support
  total         NUMERIC GENERATED ALWAYS AS (restaurant_cash + restaurant_network + credit) STORED,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

-- ── ORDERS (New Table) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_key    TEXT NOT NULL,
  customer_id   UUID REFERENCES customers(id),
  waiter_id     UUID REFERENCES profiles(id),
  total_amount  NUMERIC DEFAULT 0,
  subtotal      NUMERIC DEFAULT 0,
  tax_amount    NUMERIC DEFAULT 0,
  discount      NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'completed', 'cancelled'
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
  order_type    TEXT DEFAULT 'dine_in', -- 'dine_in', 'takeaway', 'delivery'
  notes         TEXT,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ── ORDER ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  quantity    NUMERIC NOT NULL,
  unit_price  NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  notes       TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ── RESERVATIONS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_key    TEXT NOT NULL,
  customer_id  UUID REFERENCES customers(id),
  table_number TEXT,
  party_size   INTEGER,
  reservation_time TIMESTAMPTZ NOT NULL,
  status       TEXT DEFAULT 'confirmed', -- 'confirmed', 'seated', 'cancelled', 'no_show'
  notes        TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ── EXPENSES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_key    TEXT NOT NULL,
  category_id   UUID REFERENCES categories(id),
  amount        NUMERIC NOT NULL,
  description   TEXT,
  date          DATE DEFAULT CURRENT_DATE,
  status        TEXT DEFAULT 'pending',
  receipt_url   TEXT,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ── PAYMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount        NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'cash', 'card', 'online', 'wallet'
  status        TEXT DEFAULT 'completed',
  transaction_ref TEXT,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ── TRIGGERS ─────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_restaurants BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_branches BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_inventory BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_suppliers BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_reservations BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_expenses BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_daily_sales BEFORE UPDATE ON daily_sales FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ── AUTH TRIGGER ─────────────────────────────────────────────────────────
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── POLICIES ─────────────────────────────────────────────────────────────

-- Helper: Get current user role
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: Users can see their own profile
CREATE POLICY "Profiles: view own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: admin view all" ON profiles FOR SELECT USING (get_my_role() = 'admin');

-- Restaurants: Owner can do everything
CREATE POLICY "Restaurants: owner manage" ON restaurants FOR ALL USING (org_id = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Restaurants: staff view" ON restaurants FOR SELECT USING (id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- Orders: Owner manage all
CREATE POLICY "Orders: owner manage all" ON orders FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Orders: manager manage branch" ON orders FOR ALL USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Orders: staff view branch" ON orders FOR SELECT USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Orders: waiter/cashier create" ON orders FOR INSERT WITH CHECK (get_my_role() IN ('waiter', 'cashier', 'admin', 'manager'));

-- Inventory: Owner manage all
CREATE POLICY "Inventory: owner manage all" ON inventory FOR ALL USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Inventory: manager manage branch" ON inventory FOR ALL USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Inventory: staff view branch" ON inventory FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- Daily Sales: Owner manage all
CREATE POLICY "Daily Sales: owner manage all" ON daily_sales FOR ALL USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Daily Sales: staff view branch" ON daily_sales FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- Products: Owner manage all
CREATE POLICY "Products: owner manage all" ON products FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Products: staff view" ON products FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- Customers: Owner manage all
CREATE POLICY "Customers: owner manage all" ON customers FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Customers: staff view" ON customers FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- Suppliers: Owner manage all
CREATE POLICY "Suppliers: owner manage all" ON suppliers FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Suppliers: staff view" ON suppliers FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- Expenses: Owner manage all
CREATE POLICY "Expenses: owner manage all" ON expenses FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Expenses: manager manage branch" ON expenses FOR ALL USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Expenses: staff view branch" ON expenses FOR SELECT USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- Payments: Owner manage all
CREATE POLICY "Payments: owner manage all" ON payments FOR ALL USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid()))));
CREATE POLICY "Payments: staff view branch" ON payments FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE branch_key = (SELECT branch FROM profiles WHERE id = auth.uid())));

-- Reservations: Owner manage all
CREATE POLICY "Reservations: owner manage all" ON reservations FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Reservations: manager manage branch" ON reservations FOR ALL USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Reservations: staff view branch" ON reservations FOR SELECT USING (branch_key = (SELECT branch FROM profiles WHERE id = auth.uid()));
