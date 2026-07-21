-- ============================================================
-- Fix: branch_assignments.restaurant_id missing in erp_decide_membership
-- Root cause: The erp_decide_membership RPC inserted into branch_assignments
-- with only organization_id but NOT restaurant_id. The branches RLS policy
-- `branches_member_read` checks `restaurant_id = auth_user_org_id()`, and
-- the `ba_select_owner_gm` policy also filters by restaurant_id. When
-- restaurant_id is NULL the PostgREST join from branch_assignments → branches
-- returns NULL for every row, so BranchSelector sees an empty list and
-- renders "No Branch Assigned".
--
-- This migration:
--   1. Fixes erp_decide_membership to write restaurant_id into branch_assignments
--   2. Backfills existing branch_assignments rows where restaurant_id IS NULL
-- ============================================================

-- ── 1. Backfill restaurant_id for existing branch_assignments with NULL ──────
UPDATE public.branch_assignments ba
SET    restaurant_id = b.restaurant_id,
       updated_at    = NOW()
FROM   public.branches b
WHERE  ba.branch_id      = b.id
  AND  ba.restaurant_id  IS NULL
  AND  b.restaurant_id   IS NOT NULL;

-- ── 2. Replace erp_decide_membership with restaurant_id in the INSERT ────────
CREATE OR REPLACE FUNCTION public.erp_decide_membership(
  p_membership_id uuid,
  p_decision      text,
  p_branch_id     uuid    DEFAULT NULL::uuid,
  p_permissions   jsonb   DEFAULT NULL::jsonb,
  p_reason        text    DEFAULT NULL::text
)
RETURNS erp_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  actor          public.erp_memberships;
  target         public.erp_memberships;
  result         public.erp_memberships;
  final_branch   uuid;
  final_permissions jsonb;
  external_entity uuid;
  company_name   text;
BEGIN
  -- Verify caller is an approved owner
  SELECT * INTO actor FROM public.erp_memberships
  WHERE user_id = auth.uid() AND role = 'owner' AND status = 'approved'
  LIMIT 1;

  IF actor.id IS NULL THEN
    RAISE EXCEPTION 'Only an approved owner can decide registrations';
  END IF;

  -- Fetch target membership (must belong to same org)
  SELECT * INTO target FROM public.erp_memberships
  WHERE id = p_membership_id AND restaurant_id = actor.restaurant_id
  FOR UPDATE;

  IF target.id IS NULL OR target.role = 'owner' THEN
    RAISE EXCEPTION 'Registration request was not found';
  END IF;
  IF target.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending registrations can be decided';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  final_branch := COALESCE(p_branch_id, target.branch_id);

  -- Validate branch for approval
  IF p_decision = 'approved' THEN
    IF final_branch IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = final_branch
        AND b.restaurant_id = actor.restaurant_id
        AND COALESCE(b.is_active, true)
    ) THEN
      RAISE EXCEPTION 'An active branch belonging to the owner company is required';
    END IF;
  END IF;

  -- Compute final permissions
  SELECT public.erp_default_permissions(target.role)
      || COALESCE(rp.permissions, '{}'::jsonb)
      || COALESCE(p_permissions, '{}'::jsonb)
  INTO final_permissions
  FROM (SELECT 1) seed
  LEFT JOIN public.erp_role_permissions rp
    ON rp.restaurant_id = actor.restaurant_id AND rp.role = target.role;

  -- Create external entity records for supplier/driver on approval
  IF p_decision = 'approved' AND target.role = 'supplier' THEN
    SELECT s.id INTO external_entity FROM public.suppliers s
      WHERE s.restaurant_id = actor.restaurant_id
        AND LOWER(COALESCE(s.email, '')) = LOWER(target.email)
      LIMIT 1;
    IF external_entity IS NULL THEN
      company_name := COALESCE(NULLIF(target.registration_data->>'supplier_company', ''), target.full_name);
      INSERT INTO public.suppliers (
        restaurant_id, branch_id, tenant_id, name, contact_person, phone, email,
        category, tax_number, contract_notes, status, created_by
      ) VALUES (
        actor.restaurant_id, final_branch, actor.restaurant_id::text, company_name,
        target.full_name, target.phone, target.email, target.registration_data->>'categories',
        target.registration_data->>'tax_number', target.registration_data->>'document_url',
        true, actor.email
      ) RETURNING id INTO external_entity;
    END IF;
  ELSIF p_decision = 'approved' AND target.role = 'driver' THEN
    SELECT d.id INTO external_entity FROM public.drivers d
      WHERE d.restaurant_id = actor.restaurant_id
        AND LOWER(COALESCE(d.email, '')) = LOWER(target.email)
      LIMIT 1;
    IF external_entity IS NULL THEN
      INSERT INTO public.drivers (
        restaurant_id, branch_id, tenant_id, full_name, driver_id, phone, email,
        vehicle_type, vehicle_plate, notes, status, is_active, created_by
      ) VALUES (
        actor.restaurant_id, final_branch, actor.restaurant_id::text, target.full_name,
        target.registration_data->>'license_number', target.phone, target.email,
        target.registration_data->>'vehicle_type', target.registration_data->>'vehicle_plate',
        'Approved through unified ERP registration', 'active', true, actor.email
      ) RETURNING id INTO external_entity;
    END IF;
  END IF;

  -- Update erp_memberships
  UPDATE public.erp_memberships
  SET status = p_decision,
      branch_id = CASE WHEN p_decision = 'approved' THEN final_branch ELSE branch_id END,
      permissions = CASE WHEN p_decision = 'approved' THEN final_permissions ELSE permissions END,
      linked_entity_id = CASE WHEN p_decision = 'approved' THEN external_entity ELSE linked_entity_id END,
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN NULLIF(TRIM(COALESCE(p_reason, '')), '') ELSE NULL END,
      approved_at = CASE WHEN p_decision = 'approved' THEN NOW() ELSE NULL END,
      approved_by = auth.uid(),
      updated_at = NOW()
  WHERE id = target.id
  RETURNING * INTO result;

  -- Update profiles
  UPDATE public.profiles p
  SET role = result.role,
      approval_status = result.status,
      restaurant_id = result.restaurant_id,
      organization_id = result.restaurant_id,
      branch_id = result.branch_id,
      branch = (SELECT b.branch_key FROM public.branches b WHERE b.id = result.branch_id),
      tenant_id = result.restaurant_id::text,
      permissions = result.permissions,
      rejection_reason = result.rejection_reason,
      approved_at = result.approved_at,
      approved_by = result.approved_by,
      updated_date = NOW()
  WHERE p.id = result.user_id;

  -- ── KEY FIX: Populate branch_assignments with restaurant_id ─────────────────
  IF p_decision = 'approved' AND final_branch IS NOT NULL THEN
    INSERT INTO public.branch_assignments (
      user_id, branch_id, restaurant_id, organization_id, role, assigned_by, is_primary, active
    ) VALUES (
      result.user_id, final_branch, actor.restaurant_id, actor.restaurant_id,
      result.role, auth.uid(), TRUE, TRUE
    )
    ON CONFLICT (user_id, branch_id) DO UPDATE
      SET restaurant_id  = EXCLUDED.restaurant_id,
          organization_id = EXCLUDED.organization_id,
          active         = TRUE,
          assigned_by    = auth.uid(),
          updated_at     = NOW();
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (
    restaurant_id, branch_id, tenant_id, user_email, user_name,
    action, entity_type, entity_id, old_values, new_values, created_by
  ) VALUES (
    actor.restaurant_id, result.branch_id, actor.restaurant_id::text,
    actor.email, actor.full_name, 'registration_' || p_decision,
    'erp_membership', result.id::text,
    jsonb_build_object('status', target.status, 'branch_id', target.branch_id),
    jsonb_build_object(
      'status', result.status, 'branch_id', result.branch_id,
      'role', result.role, 'linked_entity_id', result.linked_entity_id
    ),
    actor.email
  );

  RETURN result;
END;
$$;
