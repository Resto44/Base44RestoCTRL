-- Migration: 20260717_fix_rls_recursion_v2
-- Fix: Eliminate infinite recursion in erp_memberships RLS policies
-- Root cause: erp_memberships_owner_select_tenant and erp_memberships_owner_manage
--   contained subqueries that re-read erp_memberships, causing PostgreSQL
--   infinite recursion when evaluating RLS on that table.
-- Fix: New SECURITY DEFINER function erp_owner_org_ids() reads from profiles
--   (not erp_memberships) to determine owner org membership.

-- ============================================================
-- CRITICAL FIX: erp_memberships RLS Infinite Recursion v2
-- ============================================================

-- Step 1: Create SECURITY DEFINER helper that reads from profiles (NOT erp_memberships)
-- This is the key fix: owner org IDs come from profiles, breaking the recursion.
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

-- Step 2: Drop the two recursive policies on erp_memberships
DROP POLICY IF EXISTS "erp_memberships_owner_select_tenant" ON public.erp_memberships;
DROP POLICY IF EXISTS "erp_memberships_owner_manage" ON public.erp_memberships;
DROP POLICY IF EXISTS "erp_memberships_insert_public" ON public.erp_memberships;
DROP POLICY IF EXISTS "erp_memberships_delete_owner" ON public.erp_memberships;

-- Step 3: Recreate SELECT policy using non-recursive helper
CREATE POLICY "erp_memberships_owner_select_tenant"
  ON public.erp_memberships
  FOR SELECT
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- Step 4: Recreate UPDATE policy using non-recursive helper
CREATE POLICY "erp_memberships_owner_manage"
  ON public.erp_memberships
  FOR UPDATE
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- Step 5: INSERT policy for public self-registration
CREATE POLICY "erp_memberships_insert_public"
  ON public.erp_memberships
  FOR INSERT
  WITH CHECK (true);

-- Step 6: DELETE policy for owner only
CREATE POLICY "erp_memberships_delete_owner"
  ON public.erp_memberships
  FOR DELETE
  USING (
    restaurant_id IN (SELECT public.erp_owner_org_ids())
  );

-- Step 7: Grants
GRANT INSERT ON public.erp_memberships TO anon;
GRANT SELECT ON public.erp_memberships TO anon;
GRANT ALL ON public.erp_memberships TO authenticated;

-- Step 8: Backfill organization_id in profiles
UPDATE public.profiles
SET organization_id = restaurant_id
WHERE organization_id IS NULL AND restaurant_id IS NOT NULL;

-- Step 9: Drop erp_can_access_scope CASCADE (removes 3 dependent policies on other tables)
-- We immediately recreate the function and those policies below.
DROP FUNCTION IF EXISTS public.erp_can_access_scope(uuid, uuid) CASCADE;

-- Step 10: Recreate erp_can_access_scope with correct signature (DEFAULT NULL)
CREATE OR REPLACE FUNCTION public.erp_can_access_scope(p_restaurant_id uuid, p_branch_id uuid DEFAULT NULL)
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

GRANT EXECUTE ON FUNCTION public.erp_can_access_scope(uuid, uuid) TO authenticated, anon;

-- Step 11: Recreate the 3 policies that depended on erp_can_access_scope
DROP POLICY IF EXISTS "erp_role_permissions_member_select" ON public.erp_role_permissions;
CREATE POLICY "erp_role_permissions_member_select"
  ON public.erp_role_permissions
  FOR SELECT
  USING (erp_can_access_scope(restaurant_id, NULL::uuid));

DROP POLICY IF EXISTS "restaurants_member_select" ON public.restaurants;
CREATE POLICY "restaurants_member_select"
  ON public.restaurants
  FOR SELECT
  USING (erp_can_access_scope(id, NULL::uuid));

DROP POLICY IF EXISTS "branches_member_select" ON public.branches;
CREATE POLICY "branches_member_select"
  ON public.branches
  FOR SELECT
  USING (erp_can_access_scope(restaurant_id, id));

-- Step 12: Re-declare erp_is_approved_owner with explicit search_path
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

GRANT EXECUTE ON FUNCTION public.erp_is_approved_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.erp_owner_org_ids() TO authenticated, anon;
