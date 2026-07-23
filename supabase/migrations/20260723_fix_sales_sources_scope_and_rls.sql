-- Migration: 20260723_fix_sales_sources_scope_and_rls
--
-- Fixes sales-source CRUD for authenticated owners and managers.
--
-- Root cause:
--   Legacy custom sources were created without restaurant_id. The active RLS
--   scope policies correctly reject unscoped inserts and hide unscoped rows.
--   The frontend now supplies restaurant_id; this migration restores the one
--   legacy custom source to its owner's restaurant without assigning any
--   legacy system source to an arbitrary tenant.

BEGIN;

-- Backfill only non-system rows when their creator maps unambiguously to an
-- owner/organization profile. Branch placeholder '_' has no valid active
-- branch mapping, so preserve availability by making that legacy source global
-- inside the restored restaurant scope.
UPDATE public.sales_sources AS source
SET restaurant_id = COALESCE(profile.organization_id, profile.restaurant_id)::text,
    is_global = CASE
      WHEN NULLIF(BTRIM(source.branch_id), '') IS NULL OR BTRIM(source.branch_id) = '_' THEN TRUE
      ELSE source.is_global
    END,
    branch_id = CASE
      WHEN BTRIM(source.branch_id) = '_' THEN NULL
      ELSE NULLIF(BTRIM(source.branch_id), '')
    END,
    updated_date = NOW()
FROM public.profiles AS profile
WHERE source.restaurant_id IS NULL
  AND COALESCE(source.is_system, FALSE) = FALSE
  AND source.created_by IS NOT NULL
  AND LOWER(source.created_by) = LOWER(profile.email)
  AND COALESCE(profile.organization_id, profile.restaurant_id) IS NOT NULL;

-- The generic ERP policies are the authoritative scope check. Recreate the
-- sales-source policies explicitly so writes require a restaurant scope and
-- reads, updates, and deletes remain confined to the caller's approved scope.
DROP POLICY IF EXISTS "erp_scope_select" ON public.sales_sources;
DROP POLICY IF EXISTS "erp_scope_insert" ON public.sales_sources;
DROP POLICY IF EXISTS "erp_scope_update" ON public.sales_sources;
DROP POLICY IF EXISTS "erp_scope_delete" ON public.sales_sources;
DROP POLICY IF EXISTS "sales_sources_org_isolation" ON public.sales_sources;

CREATE POLICY "sales_sources_scope_select"
  ON public.sales_sources
  FOR SELECT
  TO authenticated
  USING (public.erp_can_access_scope_text(restaurant_id, branch_id));

CREATE POLICY "sales_sources_scope_insert"
  ON public.sales_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND public.erp_can_write_scope_text(restaurant_id, branch_id)
  );

CREATE POLICY "sales_sources_scope_update"
  ON public.sales_sources
  FOR UPDATE
  TO authenticated
  USING (public.erp_can_write_scope_text(restaurant_id, branch_id))
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND public.erp_can_write_scope_text(restaurant_id, branch_id)
  );

CREATE POLICY "sales_sources_scope_delete"
  ON public.sales_sources
  FOR DELETE
  TO authenticated
  USING (public.erp_can_write_scope_text(restaurant_id, branch_id));

CREATE INDEX IF NOT EXISTS idx_sales_sources_restaurant_scope
  ON public.sales_sources (restaurant_id, is_active, sort_order);

COMMIT;
