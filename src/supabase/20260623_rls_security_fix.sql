-- ============================================================
-- CRITICAL SECURITY FIX: ENABLE RLS AND TENANT ISOLATION
-- Migration 1: Enable RLS on 6 exposed tables + replace permissive policies
-- Date: 2026-06-23
-- Fixes: rls_disabled_in_public, policy_exists_rls_disabled, rls_policy_always_true
-- ============================================================

-- 1. Enable RLS on all previously exposed tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop overly permissive or always_true policies
DROP POLICY IF EXISTS "attendance_all_access" ON public.attendance;
DROP POLICY IF EXISTS "debt_payments_all_access" ON public.debt_payments;
DROP POLICY IF EXISTS "debt_records_all_access" ON public.debt_records;
DROP POLICY IF EXISTS "all_deduction_rules" ON public.deduction_rules;
DROP POLICY IF EXISTS "employee_bonuses_all_access" ON public.employee_bonuses;
DROP POLICY IF EXISTS "salary_advances_all_access" ON public.salary_advances;
DROP POLICY IF EXISTS "staff_rosters_all_access" ON public.staff_rosters;
DROP POLICY IF EXISTS "invoice_sequences_owner_all" ON public.invoice_sequences;

-- 3. Profiles: user owns their own row; owners can see their org's staff
DROP POLICY IF EXISTS "Profiles: admin view all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: view own" ON public.profiles;

CREATE POLICY "Profiles: user manage own" ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: owner view tenant staff" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.org_id = (auth.jwt() ->> 'email'))
  );

-- 4. Restaurants: owner manages their org; staff can view assigned restaurant
DROP POLICY IF EXISTS "Restaurants: owner manage" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants: staff view" ON public.restaurants;

CREATE POLICY "Restaurants: owner manage all" ON public.restaurants
  FOR ALL USING (org_id = (auth.jwt() ->> 'email'))
  WITH CHECK (org_id = (auth.jwt() ->> 'email'));

CREATE POLICY "Restaurants: staff view assigned" ON public.restaurants
  FOR SELECT USING (
    id IN (
      SELECT restaurant_id FROM public.employees WHERE email = (auth.jwt() ->> 'email')
      UNION
      SELECT restaurant_id FROM public.manager_invites WHERE email = (auth.jwt() ->> 'email')
    )
  );

-- 5. Products: owner full access; staff read-only for their org
DROP POLICY IF EXISTS "Products: owner manage all" ON public.products;
DROP POLICY IF EXISTS "Products: staff view" ON public.products;

CREATE POLICY "Products: owner manage all" ON public.products
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "Products: staff view" ON public.products
  FOR SELECT USING (
    created_by IN (
      SELECT org_id FROM public.restaurants WHERE id IN (
        SELECT restaurant_id FROM public.employees WHERE email = (auth.jwt() ->> 'email')
      )
    )
  );

-- 6. Recipes: owner full access; staff read-only for their org
DROP POLICY IF EXISTS "recipes_owner" ON public.recipes;
DROP POLICY IF EXISTS "recipes_staff" ON public.recipes;

CREATE POLICY "Recipes: owner manage all" ON public.recipes
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "Recipes: staff view" ON public.recipes
  FOR SELECT USING (
    created_by IN (
      SELECT org_id FROM public.restaurants WHERE id IN (
        SELECT restaurant_id FROM public.employees WHERE email = (auth.jwt() ->> 'email')
      )
    )
  );

-- 7. Product Variants: owner full access; staff read-only
DROP POLICY IF EXISTS "variants_manage" ON public.product_variants;
DROP POLICY IF EXISTS "variants_select" ON public.product_variants;

CREATE POLICY "Variants: owner manage all" ON public.product_variants
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "Variants: staff view" ON public.product_variants
  FOR SELECT USING (
    created_by IN (
      SELECT org_id FROM public.restaurants WHERE id IN (
        SELECT restaurant_id FROM public.employees WHERE email = (auth.jwt() ->> 'email')
      )
    )
  );

-- 8. Inventory Transactions: owner full access; staff read-only
DROP POLICY IF EXISTS "inv_tx_manage" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inv_tx_select" ON public.inventory_transactions;

CREATE POLICY "InvTx: owner manage all" ON public.inventory_transactions
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "InvTx: staff view" ON public.inventory_transactions
  FOR SELECT USING (
    created_by IN (
      SELECT org_id FROM public.restaurants WHERE id IN (
        SELECT restaurant_id FROM public.employees WHERE email = (auth.jwt() ->> 'email')
      )
    )
  );

-- 9. Replace permissive always-true policies with tenant-scoped ones
CREATE POLICY "Attendance: owner manage all" ON public.attendance
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "DebtPayments: owner manage all" ON public.debt_payments
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "DebtRecords: owner manage all" ON public.debt_records
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "DeductionRules: owner manage all" ON public.deduction_rules
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "EmployeeBonuses: owner manage all" ON public.employee_bonuses
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "SalaryAdvances: owner manage all" ON public.salary_advances
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "StaffRosters: owner manage all" ON public.staff_rosters
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "InvoiceSequences: owner manage all" ON public.invoice_sequences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.org_id = (auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.org_id = (auth.jwt() ->> 'email'))
  );
