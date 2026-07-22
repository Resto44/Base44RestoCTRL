-- =============================================================================
-- Migration: 20260722_fix_supplier_invoice_rls_and_workflow
--
-- BUG 1 FIX: Owner cannot create Supplier Invoice
--   Root cause: erp_can_write_scope_text() queries erp_memberships where
--   owner accounts created before the ERP upgrade have restaurant_id = NULL
--   (the ON CONFLICT (user_id) DO NOTHING clause silently skips the update).
--   The function must also fall back to profiles.restaurant_id / organization_id
--   so that every owner can always write to their own org.
--
-- BUG 2 FIX: Supplier Dashboard must show only their own invoices
--   Root cause: supplier_invoices has no supplier_email column, so the
--   SupplierPortalERP page (the actual supplier dashboard) cannot filter
--   by the logged-in supplier's email. We add the column, backfill it from
--   the suppliers table, and add an RLS SELECT policy that lets a supplier
--   user read only the invoices where supplier_email matches their auth email.
--   We also add an Invoices tab to SupplierPortalERP (done in frontend).
-- =============================================================================

BEGIN;

-- ── 1. Fix erp_can_write_scope_text to also accept owner via profiles ─────────
--   The function now checks erp_memberships first (fast path for non-owners),
--   then falls back to profiles for owners whose erp_membership has NULL
--   restaurant_id (legacy accounts created before the ERP membership backfill).
CREATE OR REPLACE FUNCTION public.erp_can_write_scope_text(
  p_restaurant_id text,
  p_branch_id     text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Fast path: erp_memberships row has restaurant_id populated (normal case)
    SELECT 1
    FROM public.erp_memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'approved'
      AND m.restaurant_id::text = nullif(p_restaurant_id, '')
      AND m.role IN ('owner', 'manager')
      AND (m.role = 'owner' OR nullif(p_branch_id, '') IS NULL OR m.branch_id::text = p_branch_id)
  )
  OR EXISTS (
    -- Fallback: owner whose erp_membership has NULL restaurant_id but
    -- profiles.organization_id / restaurant_id is correctly set.
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'owner'
      AND COALESCE(pr.approval_status, 'approved') = 'approved'
      AND COALESCE(pr.organization_id, pr.restaurant_id)::text = nullif(p_restaurant_id, '')
  );
$$;

GRANT EXECUTE ON FUNCTION public.erp_can_write_scope_text(text, text) TO authenticated;

-- ── 2. Fix erp_can_access_scope_text with the same owner fallback ─────────────
CREATE OR REPLACE FUNCTION public.erp_can_access_scope_text(
  p_restaurant_id text,
  p_branch_id     text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.erp_memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'approved'
      AND m.restaurant_id::text = nullif(p_restaurant_id, '')
      AND (m.role = 'owner' OR nullif(p_branch_id, '') IS NULL OR m.branch_id::text = p_branch_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'owner'
      AND COALESCE(pr.approval_status, 'approved') = 'approved'
      AND COALESCE(pr.organization_id, pr.restaurant_id)::text = nullif(p_restaurant_id, '')
  );
$$;

GRANT EXECUTE ON FUNCTION public.erp_can_access_scope_text(text, text) TO authenticated;

-- ── 3. Backfill erp_memberships.restaurant_id for owners that have NULL ───────
--   These are owners whose handle_new_user ran the ON CONFLICT (user_id) DO NOTHING
--   path (e.g. re-registrations) so restaurant_id was never set in erp_memberships.
--   Only update when the referenced restaurant actually exists (FK safety).
UPDATE public.erp_memberships m
SET restaurant_id = COALESCE(p.organization_id, p.restaurant_id),
    branch_id     = COALESCE(m.branch_id, p.branch_id),
    updated_at    = NOW()
FROM public.profiles p
JOIN public.restaurants r ON r.id = COALESCE(p.organization_id, p.restaurant_id)
WHERE m.user_id = p.id
  AND m.role = 'owner'
  AND m.status = 'approved'
  AND m.restaurant_id IS NULL
  AND COALESCE(p.organization_id, p.restaurant_id) IS NOT NULL;

-- ── 4. Add supplier_email column to supplier_invoices (BUG 2) ────────────────
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS supplier_email TEXT;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_email
  ON public.supplier_invoices (supplier_email);

-- ── 5. Backfill supplier_email from the suppliers table ──────────────────────
UPDATE public.supplier_invoices si
SET supplier_email = s.email
FROM public.suppliers s
WHERE si.supplier_id = s.id
  AND si.supplier_email IS NULL
  AND s.email IS NOT NULL;

-- ── 6. Add RLS SELECT policy so supplier users can read their own invoices ────
--   A supplier user has role = 'supplier' in profiles and their auth email
--   matches supplier_invoices.supplier_email.
DROP POLICY IF EXISTS "supplier_invoices_supplier_self_select" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_supplier_self_select"
  ON public.supplier_invoices
  FOR SELECT
  USING (
    supplier_email IS NOT NULL
    AND supplier_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'supplier'
        AND COALESCE(pr.approval_status, 'approved') = 'approved'
    )
  );

-- ── 7. Ensure supplier_invoices RLS is enabled ────────────────────────────────
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

COMMIT;
