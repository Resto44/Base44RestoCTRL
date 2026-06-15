-- ============================================================
-- QA AUDIT FIX — Missing Tables Migration
-- Date: 2026-06-15
-- Fixes: 34 tables referenced in code but missing from DB
-- ============================================================

-- ── 1. DELIVERY ORDERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  branch_key      TEXT,
  order_id        UUID,
  customer_name   TEXT,
  customer_phone  TEXT,
  customer_address TEXT,
  driver_id       UUID,
  driver_name     TEXT,
  status          TEXT DEFAULT 'pending', -- pending, assigned, picked_up, delivered, cancelled
  total_amount    NUMERIC DEFAULT 0,
  delivery_fee    NUMERIC DEFAULT 0,
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_orders_owner" ON delivery_orders FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "delivery_orders_staff_view" ON delivery_orders FOR SELECT
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 2. DRIVER SETTLEMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  driver_id       UUID,
  driver_name     TEXT,
  shift_date      DATE,
  total_orders    INTEGER DEFAULT 0,
  total_collected NUMERIC DEFAULT 0,
  cash_collected  NUMERIC DEFAULT 0,
  online_collected NUMERIC DEFAULT 0,
  delivery_fees   NUMERIC DEFAULT 0,
  expenses        NUMERIC DEFAULT 0,
  net_settlement  NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'pending', -- pending, submitted, reviewed, approved, disputed
  manager_notes   TEXT,
  submitted_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_settlements_owner" ON driver_settlements FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "driver_settlements_staff_view" ON driver_settlements FOR SELECT
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 3. DRIVER SHIFTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  driver_id       UUID,
  driver_name     TEXT,
  shift_date      DATE,
  start_time      TIME,
  end_time        TIME,
  status          TEXT DEFAULT 'active', -- active, completed, cancelled
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_shifts_owner" ON driver_shifts FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 4. DRIVER DEBTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_debts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  driver_id       UUID,
  driver_name     TEXT,
  amount          NUMERIC DEFAULT 0,
  reason          TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'outstanding', -- outstanding, paid
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_debts_owner" ON driver_debts FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 5. DRIVER INVITES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  branch          TEXT,
  status          TEXT DEFAULT 'pending', -- pending, accepted, expired
  invited_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_invites_owner" ON driver_invites FOR ALL
  USING (invited_by = (auth.jwt() ->> 'email'));
CREATE POLICY "driver_invites_self_view" ON driver_invites FOR SELECT
  USING (email = (auth.jwt() ->> 'email'));

-- ── 6. DRIVER SALES ENTRIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_sales_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  driver_id       UUID,
  driver_name     TEXT,
  order_id        UUID,
  amount          NUMERIC DEFAULT 0,
  payment_method  TEXT DEFAULT 'cash',
  date            DATE DEFAULT CURRENT_DATE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_sales_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_sales_entries_owner" ON driver_sales_entries FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 7. MANAGER INVITES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  branch          TEXT,
  role            TEXT DEFAULT 'manager',
  status          TEXT DEFAULT 'pending', -- pending, accepted, expired
  invited_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE manager_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_invites_owner" ON manager_invites FOR ALL
  USING (invited_by = (auth.jwt() ->> 'email'));
CREATE POLICY "manager_invites_self_view" ON manager_invites FOR SELECT
  USING (email = (auth.jwt() ->> 'email'));

-- ── 8. EMPLOYEE INVITES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  branch          TEXT,
  position        TEXT,
  status          TEXT DEFAULT 'pending',
  invited_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_invites_owner" ON employee_invites FOR ALL
  USING (invited_by = (auth.jwt() ->> 'email'));
CREATE POLICY "employee_invites_self_view" ON employee_invites FOR SELECT
  USING (email = (auth.jwt() ->> 'email'));

-- ── 9. INVENTORY WASTE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_waste (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  branch          TEXT,
  product_id      TEXT,
  product_name    TEXT,
  quantity        NUMERIC DEFAULT 0,
  unit            TEXT,
  reason          TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  cost            NUMERIC DEFAULT 0,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_waste ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_waste_owner" ON inventory_waste FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "inventory_waste_staff_view" ON inventory_waste FOR SELECT
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 10. INVENTORY TRANSFERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  from_branch     TEXT,
  to_branch       TEXT,
  product_id      TEXT,
  product_name    TEXT,
  qty             NUMERIC DEFAULT 0,
  unit            TEXT,
  status          TEXT DEFAULT 'pending', -- pending, completed, cancelled
  notes           TEXT,
  transfer_date   DATE DEFAULT CURRENT_DATE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_transfers_owner" ON inventory_transfers FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "inventory_transfers_staff_view" ON inventory_transfers FOR SELECT
  USING (from_branch = (SELECT branch FROM profiles WHERE id = auth.uid())
      OR to_branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 11. PURCHASE ORDERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  supplier_id     UUID,
  supplier_name   TEXT,
  order_number    TEXT,
  status          TEXT DEFAULT 'draft', -- draft, sent, partial, received, cancelled
  approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  total_amount    NUMERIC DEFAULT 0,
  items           JSONB DEFAULT '[]',
  notes           TEXT,
  expected_date   DATE,
  received_date   DATE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_owner" ON purchase_orders FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "purchase_orders_staff_view" ON purchase_orders FOR SELECT
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 12. EXPENSE CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_categories_owner" ON expense_categories FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 13. PURCHASE CATEGORIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_categories_owner" ON purchase_categories FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 14. TASKS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  assigned_to     TEXT,
  assigned_to_name TEXT,
  priority        TEXT DEFAULT 'medium', -- low, medium, high, urgent
  status          TEXT DEFAULT 'open', -- open, in_progress, done, cancelled
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_owner" ON tasks FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY "tasks_assigned_view" ON tasks FOR SELECT
  USING (assigned_to = (auth.jwt() ->> 'email'));

-- ── 15. ANNOUNCEMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  title           TEXT NOT NULL,
  message         TEXT,
  target_role     TEXT DEFAULT 'all', -- all, manager, employee, driver
  is_active       BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_owner" ON announcements FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY "announcements_staff_view" ON announcements FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- ── 16. BRAND SETTINGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  org_id          TEXT,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  font_family     TEXT DEFAULT 'Inter',
  currency_symbol TEXT DEFAULT '$',
  date_format     TEXT DEFAULT 'DD/MM/YYYY',
  language        TEXT DEFAULT 'en',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_settings_owner" ON brand_settings FOR ALL
  USING (org_id = (auth.jwt() ->> 'email')
      OR created_by = (auth.jwt() ->> 'email'));

-- ── 17. SUPPORT TICKETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  org_id          TEXT,
  subject         TEXT NOT NULL,
  message         TEXT,
  category        TEXT DEFAULT 'general',
  priority        TEXT DEFAULT 'medium',
  status          TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
  response        TEXT,
  responded_at    TIMESTAMPTZ,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_tickets_owner" ON support_tickets FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 18. AUDIT LOGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  branch          TEXT,
  user_email      TEXT,
  user_name       TEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_owner" ON audit_logs FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 19. APPROVAL POLICIES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  module          TEXT NOT NULL, -- purchases, expenses, transfers, payroll
  threshold_amount NUMERIC DEFAULT 0,
  requires_approval BOOLEAN DEFAULT TRUE,
  approver_role   TEXT DEFAULT 'owner',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE approval_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_policies_owner" ON approval_policies FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 20. COLLECTION ACTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  branch          TEXT,
  debt_id         UUID,
  customer_name   TEXT,
  action_type     TEXT DEFAULT 'call', -- call, visit, message, payment
  notes           TEXT,
  next_action_date DATE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE collection_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_actions_owner" ON collection_actions FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 21. OWNER PERSONAL FINANCE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owner_personal_finance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT,
  type            TEXT DEFAULT 'expense', -- income, expense, transfer
  category        TEXT,
  amount          NUMERIC DEFAULT 0,
  description     TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  payment_method  TEXT DEFAULT 'cash',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE owner_personal_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_personal_finance_owner" ON owner_personal_finance FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR org_id = (auth.jwt() ->> 'email'));

-- ── 22. SPONSOR TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  type            TEXT DEFAULT 'investment', -- investment, withdrawal, loan, repayment
  amount          NUMERIC DEFAULT 0,
  description     TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  sponsor_name    TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sponsor_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsor_transactions_owner" ON sponsor_transactions FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 23. SCHEDULED REPORTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  org_id          TEXT,
  name            TEXT NOT NULL,
  report_type     TEXT DEFAULT 'daily_summary',
  frequency       TEXT DEFAULT 'daily', -- daily, weekly, monthly
  recipients      JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  last_sent_at    TIMESTAMPTZ,
  next_send_at    TIMESTAMPTZ,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_reports_owner" ON scheduled_reports FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR org_id = (auth.jwt() ->> 'email'));

-- ── 24. NETWORK IMPORT BATCHES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  batch_type      TEXT DEFAULT 'products', -- products, inventory, customers
  status          TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  total_records   INTEGER DEFAULT 0,
  processed       INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  error_log       JSONB DEFAULT '[]',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE network_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network_import_batches_owner" ON network_import_batches FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 25. BATCH DOCUMENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID REFERENCES network_import_batches(id) ON DELETE CASCADE,
  restaurant_id   UUID,
  document_type   TEXT DEFAULT 'invoice',
  file_url        TEXT,
  file_name       TEXT,
  status          TEXT DEFAULT 'pending',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_documents_owner" ON batch_documents FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'));

-- ── 26. TENANT PROFILES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT UNIQUE NOT NULL,
  plan            TEXT DEFAULT 'free',
  max_branches    INTEGER DEFAULT 1,
  max_users       INTEGER DEFAULT 5,
  features        JSONB DEFAULT '{}',
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_profiles_owner" ON tenant_profiles FOR ALL
  USING (org_id = (auth.jwt() ->> 'email'));

-- ── 27. USAGE LOGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT,
  restaurant_id   UUID,
  event_type      TEXT NOT NULL,
  module          TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_logs_owner" ON usage_logs FOR ALL
  USING (org_id = (auth.jwt() ->> 'email'));

-- ── 28. STAFF ATTENDANCE (separate from attendance) ──────────────────────
CREATE TABLE IF NOT EXISTS staff_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch          TEXT,
  employee_id     UUID,
  employee_name   TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  check_in        TIME,
  check_out       TIME,
  hours_worked    NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'present', -- present, absent, late, half_day
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_attendance_owner" ON staff_attendance FOR ALL
  USING (created_by = (auth.jwt() ->> 'email')
      OR restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 29. INGREDIENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  unit            TEXT,
  cost_per_unit   NUMERIC DEFAULT 0,
  current_stock   NUMERIC DEFAULT 0,
  min_stock       NUMERIC DEFAULT 0,
  category        TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredients_owner" ON ingredients FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY "ingredients_staff_view" ON ingredients FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- ── 30. LOYALTY TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id     UUID,
  customer_name   TEXT,
  type            TEXT DEFAULT 'earn', -- earn, redeem, expire, adjust
  points          NUMERIC DEFAULT 0,
  order_id        UUID,
  order_amount    NUMERIC DEFAULT 0,
  description     TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_transactions_owner" ON loyalty_transactions FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 31. PRODUCT SIZES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_sizes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_adjustment NUMERIC DEFAULT 0,
  is_default      BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_sizes_owner" ON product_sizes FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY "product_sizes_staff_view" ON product_sizes FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- ── 32. CART ITEMS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id      TEXT,
  customer_id     UUID,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  product_name    TEXT,
  quantity        INTEGER DEFAULT 1,
  unit_price      NUMERIC DEFAULT 0,
  total_price     NUMERIC DEFAULT 0,
  modifiers       JSONB DEFAULT '[]',
  notes           TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_owner" ON cart_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY "cart_items_customer_own" ON cart_items FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE email = (auth.jwt() ->> 'email')));

-- ── 33. ORDER TRACKING ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id   UUID,
  status          TEXT NOT NULL,
  notes           TEXT,
  updated_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_tracking_owner" ON order_tracking FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ── 34. DRIVER LOCATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID,
  restaurant_id   UUID,
  latitude        NUMERIC,
  longitude       NUMERIC,
  accuracy        NUMERIC,
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_locations_owner" ON driver_locations FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- ============================================================
-- FIX: Add missing is_driver column to employees table
-- ============================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- ============================================================
-- FIX: Add RLS policies for tables with RLS enabled but no policies
-- ============================================================

-- customer_addresses (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "customer_addresses_owner" ON customer_addresses FOR ALL
  USING (customer_id IN (
    SELECT id FROM customers WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')
    )
  ));
CREATE POLICY IF NOT EXISTS "customer_addresses_self" ON customer_addresses FOR ALL
  USING (customer_id IN (
    SELECT id FROM customers WHERE email = (auth.jwt() ->> 'email')
  ));

-- customer_favorites (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "customer_favorites_owner" ON customer_favorites FOR ALL
  USING (customer_id IN (
    SELECT id FROM customers WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')
    )
  ));
CREATE POLICY IF NOT EXISTS "customer_favorites_self" ON customer_favorites FOR ALL
  USING (customer_id IN (
    SELECT id FROM customers WHERE email = (auth.jwt() ->> 'email')
  ));

-- driver_requests (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "driver_requests_owner" ON driver_requests FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- order_items (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "order_items_owner" ON order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')
    )
  ));
CREATE POLICY IF NOT EXISTS "order_items_staff_view" ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE branch_key = (SELECT branch FROM profiles WHERE id = auth.uid())
  ));

-- product_modifiers (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "product_modifiers_owner" ON product_modifiers FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY IF NOT EXISTS "product_modifiers_staff_view" ON product_modifiers FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- product_modifier_options (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "product_modifier_options_owner" ON product_modifier_options FOR ALL
  USING (modifier_id IN (
    SELECT id FROM product_modifiers WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')
    )
  ));

-- promotions (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "promotions_owner" ON promotions FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY IF NOT EXISTS "promotions_public_view" ON promotions FOR SELECT
  USING (is_active = TRUE);

-- recipe_ingredients (RLS enabled, no policies)
CREATE POLICY IF NOT EXISTS "recipe_ingredients_owner" ON recipe_ingredients FOR ALL
  USING (recipe_id IN (
    SELECT id FROM recipes WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')
    )
  ));
CREATE POLICY IF NOT EXISTS "recipe_ingredients_staff_view" ON recipe_ingredients FOR SELECT
  USING (recipe_id IN (
    SELECT id FROM recipes WHERE restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- ============================================================
-- FIX: Enable RLS on recipes table (currently disabled — CRITICAL)
-- ============================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "recipes_owner" ON recipes FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
CREATE POLICY IF NOT EXISTS "recipes_staff_view" ON recipes FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- FIX: Add missing columns to expenses table for RLS filter
-- ============================================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_key TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- ============================================================
-- FIX: Fix inventory RLS — add restaurant_id column
-- ============================================================
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_orders_branch ON delivery_orders(branch);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_driver ON delivery_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_driver ON driver_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_inventory_waste_branch ON inventory_waste(branch);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_branches ON inventory_transfers(from_branch, to_branch);
CREATE INDEX IF NOT EXISTS idx_cart_items_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
