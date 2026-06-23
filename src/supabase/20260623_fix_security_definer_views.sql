-- ============================================================
-- SECURITY FIX: Recreate SECURITY DEFINER views as SECURITY INVOKER
-- Migration 3
-- Date: 2026-06-23
-- Fixes: security_definer_view, rls_policy_always_true (remaining),
--        anon_security_definer_function_executable
-- ============================================================

-- Fix views: SECURITY INVOKER ensures RLS policies apply to the querying user
DROP VIEW IF EXISTS public.procurement_analytics;
CREATE VIEW public.procurement_analytics WITH (security_invoker = true) AS
 SELECT branch, count(*) AS total_invoices, sum(total_amount) AS total_purchases,
   sum((total_amount - paid_amount)) AS outstanding_payables,
   sum(CASE WHEN ((due_date < CURRENT_DATE) AND (status <> 'paid')) THEN (total_amount - paid_amount) ELSE 0 END) AS overdue_payables
 FROM supplier_invoices GROUP BY branch;

DROP VIEW IF EXISTS public.v_collection_dashboard;
CREATE VIEW public.v_collection_dashboard WITH (security_invoker = true) AS
 SELECT created_by, branch,
   COALESCE(sum(CASE WHEN (date = CURRENT_DATE) THEN amount ELSE 0 END), 0) AS collected_today,
   COALESCE(sum(CASE WHEN (date >= date_trunc('week', CURRENT_DATE::timestamptz)) THEN amount ELSE 0 END), 0) AS collected_this_week,
   COALESCE(sum(CASE WHEN (date >= date_trunc('month', CURRENT_DATE::timestamptz)) THEN amount ELSE 0 END), 0) AS collected_this_month,
   COALESCE(sum(amount), 0) AS collected_all_time,
   count(DISTINCT customer_name) AS unique_customers_collected,
   count(CASE WHEN (date = CURRENT_DATE) THEN 1 ELSE NULL END) AS collections_today_count
 FROM customer_collections cc GROUP BY created_by, branch;

DROP VIEW IF EXISTS public.v_customer_aging;
CREATE VIEW public.v_customer_aging WITH (security_invoker = true) AS
 SELECT party_name AS customer_name, party_phone AS phone, branch, created_by,
   COALESCE(sum(CASE WHEN ((CURRENT_DATE - COALESCE(due_date, date)) <= 30) THEN remaining_amount ELSE 0 END), 0) AS bucket_0_30,
   COALESCE(sum(CASE WHEN (((CURRENT_DATE - COALESCE(due_date, date)) >= 31) AND ((CURRENT_DATE - COALESCE(due_date, date)) <= 60)) THEN remaining_amount ELSE 0 END), 0) AS bucket_31_60,
   COALESCE(sum(CASE WHEN (((CURRENT_DATE - COALESCE(due_date, date)) >= 61) AND ((CURRENT_DATE - COALESCE(due_date, date)) <= 90)) THEN remaining_amount ELSE 0 END), 0) AS bucket_61_90,
   COALESCE(sum(CASE WHEN ((CURRENT_DATE - COALESCE(due_date, date)) > 90) THEN remaining_amount ELSE 0 END), 0) AS bucket_over_90,
   COALESCE(sum(remaining_amount), 0) AS total_outstanding,
   max((CURRENT_DATE - COALESCE(due_date, date))) AS max_days_overdue
 FROM debt_records dr
 WHERE ((party_type = 'customer') AND (status = ANY (ARRAY['open','partial','overdue'])) AND (remaining_amount > 0))
 GROUP BY party_name, party_phone, branch, created_by;

DROP VIEW IF EXISTS public.v_customer_summary;
CREATE VIEW public.v_customer_summary WITH (security_invoker = true) AS
 SELECT party_name AS customer_name, party_phone AS phone, branch, created_by,
   count(DISTINCT id) AS credit_sale_count,
   COALESCE(sum(total_amount), 0) AS total_credit_sales,
   COALESCE(sum(paid_amount), 0) AS total_collected,
   COALESCE(sum(remaining_amount), 0) AS outstanding_balance,
   max(date) AS last_transaction_date,
   count(CASE WHEN (status = 'overdue') THEN 1 ELSE NULL END) AS overdue_count,
   count(CASE WHEN (status = ANY (ARRAY['open','partial','overdue'])) THEN 1 ELSE NULL END) AS open_count
 FROM debt_records dr WHERE (party_type = 'customer')
 GROUP BY party_name, party_phone, branch, created_by;

-- Revoke anon EXECUTE on internal/trigger functions
REVOKE EXECUTE ON FUNCTION public.update_updated_date() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_date_col() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_product_stock() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_debt_invoice_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_sales_invoice_number(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_purchase_invoice_number(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM anon;

-- Fix remaining permissive policies
DROP POLICY IF EXISTS "driver_requests_all" ON public.driver_requests;
CREATE POLICY "DriverRequests: authenticated only" ON public.driver_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "drivers_all_access" ON public.drivers;
CREATE POLICY "Drivers: owner manage all" ON public.drivers
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "all_employee_bonuses" ON public.employee_bonuses;
CREATE POLICY "EmployeeBonuses: owner manage all v2" ON public.employee_bonuses
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "employees_all_access" ON public.employees;
CREATE POLICY "Employees: owner manage all" ON public.employees
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "all_payroll_runs" ON public.payroll_runs;
CREATE POLICY "PayrollRuns: owner manage all" ON public.payroll_runs
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Purchases: owner manage all" ON public.purchases;
CREATE POLICY "Purchases: owner manage all" ON public.purchases
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "all_salary_advances" ON public.salary_advances;
CREATE POLICY "SalaryAdvances: owner manage all v2" ON public.salary_advances
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "all_staff_rosters" ON public.staff_rosters;
CREATE POLICY "StaffRosters: owner manage all v2" ON public.staff_rosters
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));
