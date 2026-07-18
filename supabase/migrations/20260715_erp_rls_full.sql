-- =============================================================================
-- ERP Multi-Tenant Full Schema + RLS Migration
-- Applies: erp_registrations, branch_assignments, profiles updates,
--          and complete RLS policies for tenant + branch isolation
-- =============================================================================

-- ── 1. Ensure profiles has all required columns ──────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 2. Create erp_registrations table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  role            TEXT NOT NULL CHECK (role IN ('owner','general_manager','manager','employee','kitchen','driver','supplier')),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  rejection_reason TEXT,
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_reg_email ON erp_registrations(email);
CREATE INDEX IF NOT EXISTS idx_erp_reg_status ON erp_registrations(status);
CREATE INDEX IF NOT EXISTS idx_erp_reg_role ON erp_registrations(role);
CREATE INDEX IF NOT EXISTS idx_erp_reg_restaurant ON erp_registrations(restaurant_id);

-- ── 3. Create branch_assignments table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  role            TEXT NOT NULL,
  assigned_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_assign_user ON branch_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_assign_branch ON branch_assignments(branch_id);

-- ── 4. Enable RLS on all relevant tables ─────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_assignments ENABLE ROW LEVEL SECURITY;

-- ── 5. Helper functions for RLS ───────────────────────────────────────────────

-- Get current user's role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Get current user's restaurant_id
CREATE OR REPLACE FUNCTION auth_user_restaurant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT restaurant_id FROM profiles WHERE id = auth.uid()
$$;

-- Get current user's branch_id
CREATE OR REPLACE FUNCTION auth_user_branch_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$;

-- Check if user is owner or general_manager (cross-branch access)
CREATE OR REPLACE FUNCTION is_owner_or_gm()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role IN ('owner', 'general_manager') FROM profiles WHERE id = auth.uid()
$$;

-- ── 6. RLS Policies: profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_owner_gm" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_owner" ON profiles;

-- Users can always read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Owner and GM can read all profiles in their restaurant
CREATE POLICY "profiles_select_owner_gm"
  ON profiles FOR SELECT
  USING (
    is_owner_or_gm() AND (
      restaurant_id = auth_user_restaurant_id()
      OR auth_user_restaurant_id() IS NULL
    )
  );

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Owner can update any profile in their restaurant
CREATE POLICY "profiles_update_owner"
  ON profiles FOR UPDATE
  USING (
    auth_user_role() = 'owner' AND (
      restaurant_id = auth_user_restaurant_id()
      OR auth_user_restaurant_id() IS NULL
    )
  );

-- ── 7. RLS Policies: erp_registrations ───────────────────────────────────────
DROP POLICY IF EXISTS "erp_reg_select_own" ON erp_registrations;
DROP POLICY IF EXISTS "erp_reg_select_owner_gm" ON erp_registrations;
DROP POLICY IF EXISTS "erp_reg_insert_public" ON erp_registrations;
DROP POLICY IF EXISTS "erp_reg_update_owner" ON erp_registrations;

-- Users can see their own registration
CREATE POLICY "erp_reg_select_own"
  ON erp_registrations FOR SELECT
  USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Owner and GM can see all registrations in their restaurant
CREATE POLICY "erp_reg_select_owner_gm"
  ON erp_registrations FOR SELECT
  USING (
    is_owner_or_gm() AND (
      restaurant_id = auth_user_restaurant_id()
      OR restaurant_id IS NULL
      OR auth_user_restaurant_id() IS NULL
    )
  );

-- Anyone can insert a registration (public sign-up)
CREATE POLICY "erp_reg_insert_public"
  ON erp_registrations FOR INSERT
  WITH CHECK (true);

-- Owner can update (approve/reject) registrations
CREATE POLICY "erp_reg_update_owner"
  ON erp_registrations FOR UPDATE
  USING (
    auth_user_role() IN ('owner', 'general_manager')
  );

-- ── 8. RLS Policies: branch_assignments ──────────────────────────────────────
DROP POLICY IF EXISTS "ba_select_own" ON branch_assignments;
DROP POLICY IF EXISTS "ba_select_owner_gm" ON branch_assignments;
DROP POLICY IF EXISTS "ba_insert_owner" ON branch_assignments;
DROP POLICY IF EXISTS "ba_update_owner" ON branch_assignments;
DROP POLICY IF EXISTS "ba_delete_owner" ON branch_assignments;

-- Users can see their own assignments
CREATE POLICY "ba_select_own"
  ON branch_assignments FOR SELECT
  USING (user_id = auth.uid());

-- Owner and GM can see all assignments in their restaurant
CREATE POLICY "ba_select_owner_gm"
  ON branch_assignments FOR SELECT
  USING (
    is_owner_or_gm() AND (
      restaurant_id = auth_user_restaurant_id()
      OR auth_user_restaurant_id() IS NULL
    )
  );

-- Owner can insert assignments
CREATE POLICY "ba_insert_owner"
  ON branch_assignments FOR INSERT
  WITH CHECK (auth_user_role() IN ('owner', 'general_manager'));

-- Owner can update assignments
CREATE POLICY "ba_update_owner"
  ON branch_assignments FOR UPDATE
  USING (auth_user_role() IN ('owner', 'general_manager'));

-- Owner can delete assignments
CREATE POLICY "ba_delete_owner"
  ON branch_assignments FOR DELETE
  USING (auth_user_role() = 'owner');

-- ── 9. Update existing table RLS for branch isolation ────────────────────────

-- Employees table: enforce branch isolation
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_branch_isolation" ON employees;
CREATE POLICY "employees_branch_isolation"
  ON employees FOR ALL
  USING (
    is_owner_or_gm()
    OR branch_id = auth_user_branch_id()
    OR branch_id IN (SELECT branch_id FROM branch_assignments WHERE user_id = auth.uid() AND active = true)
  );

-- Delivery orders: enforce branch isolation
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_orders_branch_isolation" ON delivery_orders;
CREATE POLICY "delivery_orders_branch_isolation"
  ON delivery_orders FOR ALL
  USING (
    is_owner_or_gm()
    OR branch_id = auth_user_branch_id()
    OR branch_id IN (SELECT branch_id FROM branch_assignments WHERE user_id = auth.uid() AND active = true)
  );

-- ── 10. Grant permissions ─────────────────────────────────────────────────────
GRANT ALL ON erp_registrations TO authenticated;
GRANT ALL ON branch_assignments TO authenticated;
GRANT SELECT ON erp_registrations TO anon;
GRANT INSERT ON erp_registrations TO anon;

-- ── 11. Updated_at trigger for erp_registrations ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erp_registrations_updated_at ON erp_registrations;
CREATE TRIGGER erp_registrations_updated_at
  BEFORE UPDATE ON erp_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
