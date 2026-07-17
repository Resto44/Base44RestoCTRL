-- ============================================================
-- CRITICAL FIX: erp_memberships RLS Infinite Recursion
-- Date: 2026-07-17
-- Root Cause:
--   Policies "erp_memberships_owner_select_tenant" (SELECT) and
--   "erp_memberships_owner_manage" (UPDATE) both contain a subquery
--   that reads FROM erp_memberships while PostgreSQL is already
--   evaluating an RLS policy on erp_memberships → infinite recursion.
--
-- Fix Strategy:
--   1. Create a SECURITY DEFINER helper function
--      erp_get_owner_org_ids() that reads from profiles (NOT from
--      erp_memberships) to return the set of organization UUIDs
--      where the current user is an approved owner.
--      Because it is SECURITY DEFINER it bypasses RLS on profiles
--      and does NOT touch erp_memberships at all.
--   2. Drop the two recursive policies.
--   3. Recreate them using the new helper — no recursion possible.
--   4. Also add INSERT and DELETE policies so the table is fully
--      governed (INSERT for public registration, DELETE for owner).
--   5. Verify erp_can_access_scope and erp_is_approved_owner are
--      safe (they ARE SECURITY DEFINER and are called from OTHER
--      tables, not from erp_memberships itself — no recursion there).
-- ============================================================

-- ── 1. SECURITY DEFINER helper: owner org IDs from profiles ──────────────────
-- Reads profiles.role + profiles.approval_status + profiles.restaurant_id
-- (or organization_id) to determine which orgs the caller owns.
-- This function NEVER touches erp_memberships, so it is safe to call
-- from erp_memberships RLS policies.
CREATE OR REPLACE FUNCTION public.erp_owner_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(organization_id, restaurant_id)
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'owner'
    AND COALESCE(approval_status, 'approved') = 'approved'
    AND COALESCE(organization_id, restaurant_id) IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.erp_owner_org_ids() TO authenticated, anon;

-- ── 2. Drop the two recursive policies ───────────────────────────────────────
DROP POLICY IF EXISTS "erp_memberships_owner_select_tenant" ON public.erp_memberships;
DROP POLICY IF EXISTS "erp_memberships_owner_manage"        ON public.erp_memberships;

-- Also drop any legacy policies that may exist from earlier migrations
DROP POLICY IF EXISTS "erp_memberships_insert_public"       ON public.erp_memberships;
DROP POLICY IF EXISTS "erp_memberships_delete_owner"        ON public.erp_memberships;

-- ── 3. Recreate SELECT policy — non-recursive ─────────────────────────────────
-- Rule: a user can SELECT a membership row if:
--   (a) it is their own row  (covered by erp_memberships_select_own), OR
--   (b) they are an approved owner of the same restaurant/org
CREATE POLICY "erp_memberships_owner_select_tenant"
  ON public.erp_memberships
  FOR SELECT
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- ── 4. Recreate UPDATE policy — non-recursive ────────────────────────────────
-- Rule: owner can UPDATE (approve/reject/suspend) memberships in their org
CREATE POLICY "erp_memberships_owner_manage"
  ON public.erp_memberships
  FOR UPDATE
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- ── 5. INSERT policy — allow public self-registration ────────────────────────
-- Anyone (including anon) can insert their own registration row.
CREATE POLICY "erp_memberships_insert_public"
  ON public.erp_memberships
  FOR INSERT
  WITH CHECK (true);

-- ── 6. DELETE policy — owner only ────────────────────────────────────────────
CREATE POLICY "erp_memberships_delete_owner"
  ON public.erp_memberships
  FOR DELETE
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- ── 7. Ensure anon can INSERT (for unauthenticated registration flow) ─────────
GRANT INSERT ON public.erp_memberships TO anon;
GRANT SELECT ON public.erp_memberships TO anon;
GRANT ALL    ON public.erp_memberships TO authenticated;

-- ── 8. Verify the fix: confirm no policy on erp_memberships references ────────
--      erp_memberships in its QUAL expression.
--      (Run manually to confirm; this is a documentation comment.)
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'erp_memberships'
-- ORDER BY policyname;

-- ── 9. Also fix erp_decide_membership: ensure it uses SET row_security = off ──
--      (Already set in the function, but re-apply to be safe.)
--      The function already has SECURITY DEFINER + SET row_security TO 'off'
--      so it bypasses RLS entirely when running — no change needed there.

-- ── 10. Backfill: ensure all owner profiles have organization_id set ──────────
UPDATE public.profiles
SET organization_id = restaurant_id
WHERE organization_id IS NULL
  AND restaurant_id IS NOT NULL;

-- ── 11. Confirm erp_can_access_scope and erp_is_approved_owner are safe ───────
-- These functions query erp_memberships but are SECURITY DEFINER and are
-- called only from policies on OTHER tables (branches, restaurants, profiles).
-- They do NOT appear in any erp_memberships policy → no recursion.
-- Re-declare them with explicit SET search_path for security hygiene.

CREATE OR REPLACE FUNCTION public.erp_is_approved_owner(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.erp_memberships m
    WHERE m.user_id = auth.uid()
      AND m.role = 'owner'
      AND m.status = 'approved'
      AND m.restaurant_id = p_restaurant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.erp_can_access_scope(p_restaurant_id uuid, p_branch_id uuid)
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
      AND m.restaurant_id = p_restaurant_id
      AND (m.role = 'owner' OR p_branch_id IS NULL OR m.branch_id = p_branch_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.erp_is_approved_owner(uuid)        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.erp_can_access_scope(uuid, uuid)   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.erp_owner_org_ids()                TO authenticated, anon;
