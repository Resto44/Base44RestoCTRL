-- ============================================================
-- Migration: Fix Purchase Invoice Permission + Unified Supplier Dropdown
-- Date: 2026-07-22
-- Fixes:
--   BUG 1 — supplier_invoices INSERT fails with
--            "permission denied for table users"
--            Root cause: supplier_invoices_supplier_self_select policy
--            applies to {public} role and queries auth.users directly,
--            which the authenticated role cannot access. PostgreSQL
--            evaluates ALL policies (including SELECT) when checking
--            row visibility during INSERT. Replaced auth.users subquery
--            with profiles.email lookup (no privilege escalation needed).
--            Also fixed erp_scope_insert to allow owner inserts when
--            restaurant_id is NULL by enriching the payload from profiles.
--
--   BUG 2 — Supplier dropdown only shows manually-created suppliers.
--            Root cause: erp_decide_membership creates the supplier record
--            with created_by = actor.email (owner email), but the
--            PurchaseInvoiceForm loads suppliers filtered by
--            ownerFilter = { created_by: user.email } — which is correct
--            for manually-created suppliers. However, the approved supplier
--            record (Atawllaua) was created with created_by = supplier email
--            because the erp_decide_membership INSERT used actor.email
--            correctly, but a second supplier record was created by the
--            supplier themselves via the portal with created_by = their own
--            email. The fix is to load suppliers by restaurant_id scope
--            (not created_by), which is the correct ERP multi-tenant pattern.
--            Added a SECURITY DEFINER RPC get_org_suppliers() that returns
--            all suppliers for the caller's organization.
-- ============================================================

-- ── FIX 1: Replace supplier_invoices_supplier_self_select policy ──────────
-- The old policy used: SELECT users.email FROM auth.users WHERE users.id = auth.uid()
-- The authenticated role does NOT have SELECT on auth.users, causing
-- "permission denied for table users" during any DML on supplier_invoices.
-- Replace with profiles.email lookup (profiles is in public schema, accessible).

DROP POLICY IF EXISTS "supplier_invoices_supplier_self_select" ON public.supplier_invoices;

CREATE POLICY "supplier_invoices_supplier_self_select"
  ON public.supplier_invoices
  FOR SELECT
  TO public
  USING (
    supplier_email IS NOT NULL
    AND supplier_email = (
      SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'supplier'
        AND COALESCE(pr.approval_status, 'approved') = 'approved'
    )
  );

-- ── FIX 2: Ensure erp_scope_insert allows owner when restaurant_id is NULL ─
-- The erp_can_write_scope_text function returns FALSE when restaurant_id IS NULL
-- even though the owner's profile has the correct organization_id.
-- The fix is to make the INSERT policy also accept the case where the row's
-- restaurant_id IS NULL and the caller is an approved owner (profiles fallback).
-- We replace the INSERT policy with one that handles both cases.

DROP POLICY IF EXISTS "erp_scope_insert" ON public.supplier_invoices;

CREATE POLICY "erp_scope_insert"
  ON public.supplier_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Standard ERP scope check (restaurant_id populated in payload)
    erp_can_write_scope_text((restaurant_id)::text, (branch_id)::text)
    OR
    -- Fallback: owner inserting without restaurant_id in payload
    -- (legacy form behaviour — restaurant_id will be backfilled by trigger)
    (
      restaurant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid()
          AND pr.role = 'owner'
          AND COALESCE(pr.approval_status, 'approved') = 'approved'
      )
    )
  );

-- ── FIX 3: Trigger to auto-populate restaurant_id on supplier_invoices INSERT ─
-- When the form omits restaurant_id (legacy behaviour), backfill from profiles.
-- This ensures the row is correctly scoped to the owner's organization.

CREATE OR REPLACE FUNCTION public.fn_supplier_invoices_set_restaurant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only backfill when restaurant_id is missing
  IF NEW.restaurant_id IS NULL THEN
    SELECT COALESCE(organization_id, restaurant_id)
      INTO NEW.restaurant_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_invoices_set_restaurant_id ON public.supplier_invoices;
CREATE TRIGGER trg_supplier_invoices_set_restaurant_id
  BEFORE INSERT ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_supplier_invoices_set_restaurant_id();

-- ── FIX 4: SECURITY DEFINER RPC for unified supplier list ─────────────────
-- Returns all suppliers belonging to the caller's organization.
-- Includes both manually-created suppliers (created_by = owner email) and
-- suppliers approved via Request Center (created_by = owner email via
-- erp_decide_membership, or created_by = supplier email via portal).
-- Scoped strictly to the caller's restaurant_id — no cross-tenant leakage.

CREATE OR REPLACE FUNCTION public.get_org_suppliers()
RETURNS SETOF public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  -- Resolve caller's organization
  SELECT COALESCE(organization_id, restaurant_id)
    INTO v_restaurant_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT s.*
    FROM public.suppliers s
    WHERE s.restaurant_id = v_restaurant_id
      AND COALESCE(s.status, true) = true
    ORDER BY s.name;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.get_org_suppliers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_suppliers() TO authenticated;

-- ── FIX 5: Fix erp_decide_membership to ensure approved supplier has correct created_by ─
-- When a supplier is approved via Request Center, the supplier record in the
-- suppliers table should have created_by = owner_email (actor.email), not the
-- supplier's own email. The current erp_decide_membership already does this
-- (INSERT ... created_by = actor.email). However, if a duplicate supplier record
-- was created by the supplier themselves (via portal), we need to ensure the
-- restaurant_id is set correctly so the unified RPC can find it.
-- Update existing supplier records that have restaurant_id set but created_by
-- is the supplier's own email — these were created via portal self-registration.
-- No data change needed here since get_org_suppliers() uses restaurant_id scope.

-- ── FIX 6: Fix erp_registrations policy that queries auth.users ──────────
-- NOTE: supplier_invites table does not exist in production (skipped)
DROP POLICY IF EXISTS "Users can view their own registrations" ON public.erp_registrations;

CREATE POLICY "Users can view their own registrations"
  ON public.erp_registrations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR email = (
      SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()
    )
  );

-- Done.
