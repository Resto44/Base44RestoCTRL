-- Secure invitation-only ERP onboarding
--
-- This migration makes owner-issued invitations the sole non-owner onboarding path.
-- It deliberately keeps owner organization setup separate, while preventing all
-- public organization/branch enumeration and non-owner self-registration.

BEGIN;

-- ── 1. Invitation lifecycle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.erp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  email text,
  phone text,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('general_manager', 'manager', 'employee', 'supplier', 'driver', 'kitchen')),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CONSTRAINT erp_invitations_contact_check CHECK (
    num_nonnulls(NULLIF(btrim(email), ''), NULLIF(btrim(phone), '')) = 1
  )
);

CREATE INDEX IF NOT EXISTS erp_invitations_owner_pending_idx
  ON public.erp_invitations (restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS erp_invitations_branch_pending_idx
  ON public.erp_invitations (branch_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS erp_invitations_pending_email_scope_idx
  ON public.erp_invitations (restaurant_id, lower(email))
  WHERE status = 'pending' AND email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS erp_invitations_pending_phone_scope_idx
  ON public.erp_invitations (restaurant_id, phone)
  WHERE status = 'pending' AND phone IS NOT NULL;

ALTER TABLE public.erp_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_invitations_owner_select ON public.erp_invitations;
CREATE POLICY erp_invitations_owner_select
  ON public.erp_invitations
  FOR SELECT
  TO authenticated
  USING (public.erp_is_approved_owner(restaurant_id));

REVOKE ALL ON TABLE public.erp_invitations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.erp_invitations FROM authenticated;
GRANT SELECT ON TABLE public.erp_invitations TO authenticated;

-- Phone-only invitations are supported, so membership email must be nullable.
ALTER TABLE public.erp_memberships ALTER COLUMN email DROP NOT NULL;

-- ── 2. Persisted permission defaults, aligned with the ERP role model ─────────
CREATE OR REPLACE FUNCTION public.erp_default_permissions(p_role text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(p_role, ''))
    WHEN 'general_manager' THEN '{
      "viewDashboard":true,"viewSales":true,"viewPurchases":true,"viewInventory":true,
      "viewOrders":true,"viewStaff":true,"viewEmployees":true,"viewPayroll":true,
      "viewEmployeeControl":true,"viewStaffAttendance":true,"viewTreasury":true,
      "viewExpenses":true,"viewDebts":true,"viewSuppliers":true,"viewDelivery":true,
      "viewReports":true,"viewAttendance":true,"recordAttendance":true,"viewSchedule":true,
      "viewTasks":true,"viewProfile":true,"viewDeliveries":true,"updateDelivery":true,
      "viewEarnings":true,"viewKitchenQueue":true,"updatePrepStatus":true,"uploadSales":true,
      "viewAlerts":true,"viewSupport":true,"manageUsers":true,"manageCustomers":true,
      "manageDrivers":true,"manageKitchen":true,"manageSponsors":true,
      "manageSettings":false,"manageBranches":false,"manageRoles":false,"viewBilling":false
    }'::jsonb
    WHEN 'manager' THEN '{
      "viewDashboard":true,"viewSales":true,"viewExpenses":true,"viewInventory":true,
      "viewEmployees":true,"viewCustomers":true,"viewPurchases":true,"viewOrders":true,
      "viewSuppliers":true,"viewReports":true,"recordAttendance":true,"viewTasks":true
    }'::jsonb
    WHEN 'employee' THEN '{
      "viewDashboard":true,"viewAttendance":true,"recordAttendance":true,"viewTasks":true,
      "viewSales":true,"viewOrders":true
    }'::jsonb
    WHEN 'supplier' THEN '{
      "viewDashboard":true,"viewPurchaseOrders":true,"viewInvoices":true,"viewPayments":true,
      "viewProducts":true
    }'::jsonb
    WHEN 'driver' THEN '{
      "viewDashboard":true,"viewDeliveries":true,"updateDelivery":true,"viewRoutes":true,
      "viewEarnings":true
    }'::jsonb
    WHEN 'kitchen' THEN '{
      "viewDashboard":true,"viewKitchenQueue":true,"updatePrepStatus":true,
      "viewProductionQueue":true,"viewRecipeStatus":true
    }'::jsonb
    WHEN 'owner' THEN '{"all":true}'::jsonb
    ELSE '{}'::jsonb
  END;
$function$;

-- Owner-scoped list functions keep organization and branch discovery out of public
-- client queries while supporting owners who operate more than one organization.
CREATE OR REPLACE FUNCTION public.list_erp_owned_organizations()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
  SELECT r.id, r.name
  FROM public.restaurants r
  JOIN public.erp_memberships m ON m.restaurant_id = r.id
  WHERE m.user_id = auth.uid()
    AND m.role = 'owner'
    AND m.status = 'approved'
    AND coalesce(r.is_active, true)
  ORDER BY r.name;
$function$;

CREATE OR REPLACE FUNCTION public.list_erp_owned_branches(p_restaurant_id uuid)
RETURNS TABLE (id uuid, name text, label text, branch_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
  SELECT b.id, b.name, b.name AS label, b.branch_key
  FROM public.branches b
  JOIN public.erp_memberships m ON m.restaurant_id = b.restaurant_id
  WHERE b.restaurant_id = p_restaurant_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
    AND m.status = 'approved'
    AND coalesce(b.is_active, true)
  ORDER BY b.name;
$function$;

-- ── 3. Owner-only invitation issuance and revocation ──────────────────────────
CREATE OR REPLACE FUNCTION public.create_erp_invitation(
  p_role text,
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $function$
DECLARE
  actor public.erp_memberships;
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := NULLIF(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := NULLIF(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_token text;
  v_hash text;
  v_invitation public.erp_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create an invitation';
  END IF;

  SELECT * INTO actor
  FROM public.erp_memberships
  WHERE user_id = auth.uid()
    AND role = 'owner'
    AND status = 'approved'
    AND restaurant_id = p_restaurant_id
  LIMIT 1;

  IF actor.id IS NULL THEN
    RAISE EXCEPTION 'Only the approved owner of the selected organization can create staff invitations';
  END IF;

  IF v_role NOT IN ('general_manager', 'manager', 'employee', 'supplier', 'driver', 'kitchen') THEN
    RAISE EXCEPTION 'The selected role cannot be provisioned by invitation';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'A staff member name is required';
  END IF;
  IF (v_email IS NULL) = (v_phone IS NULL) THEN
    RAISE EXCEPTION 'Provide exactly one identity channel: either an email address or a phone number';
  END IF;
  IF v_email IS NOT NULL AND v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) < 8 THEN
    RAISE EXCEPTION 'A valid phone number is required';
  END IF;
  IF jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Permissions must be a JSON object';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.restaurant_id = p_restaurant_id
      AND coalesce(b.is_active, true)
  ) THEN
    RAISE EXCEPTION 'An active branch in the selected organization is required';
  END IF;

  -- A staff member can have only one active invitation in an organization.
  UPDATE public.erp_invitations
  SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  WHERE restaurant_id = p_restaurant_id
    AND status = 'pending'
    AND (
      (v_email IS NOT NULL AND lower(email) = v_email)
      OR (v_phone IS NOT NULL AND phone = v_phone)
    );

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.erp_invitations (
    token_hash, email, phone, full_name, role, restaurant_id, branch_id,
    permissions, status, expires_at, created_by
  ) VALUES (
    v_hash, v_email, v_phone, v_name, v_role, p_restaurant_id, p_branch_id,
    coalesce(p_permissions, '{}'::jsonb), 'pending', now() + interval '7 days', auth.uid()
  )
  RETURNING * INTO v_invitation;

  INSERT INTO public.audit_logs (
    restaurant_id, branch_id, tenant_id, user_email, user_name,
    action, entity_type, entity_id, old_values, new_values, created_by
  ) VALUES (
    p_restaurant_id, p_branch_id, p_restaurant_id::text, actor.email, actor.full_name,
    'invitation_created', 'erp_invitation', v_invitation.id::text, '{}'::jsonb,
    jsonb_build_object(
      'role', v_role, 'email', v_email, 'phone', v_phone,
      'expires_at', v_invitation.expires_at
    ), actor.email
  );

  RETURN jsonb_build_object(
    'invitation_id', v_invitation.id,
    'token', v_token,
    'expires_at', v_invitation.expires_at,
    'status', v_invitation.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_erp_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  invitation public.erp_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to revoke an invitation';
  END IF;

  SELECT * INTO invitation
  FROM public.erp_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF NOT public.erp_is_approved_owner(invitation.restaurant_id) THEN
    RAISE EXCEPTION 'Only the organization owner can revoke this invitation';
  END IF;
  IF invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending invitation can be revoked';
  END IF;

  UPDATE public.erp_invitations
  SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  WHERE id = invitation.id;

  RETURN jsonb_build_object('id', invitation.id, 'status', 'revoked');
END;
$function$;

-- ── 4. Atomic, verified, one-time invitation activation ──────────────────────
CREATE OR REPLACE FUNCTION public.activate_erp_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $function$
DECLARE
  invitation public.erp_invitations;
  v_hash text;
  v_email text;
  v_phone text;
  v_email_confirmed_at timestamptz;
  v_phone_confirmed_at timestamptz;
  v_permissions jsonb;
  v_linked_entity uuid;
  v_dashboard text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in or verify your identity before activating an invitation';
  END IF;
  IF NULLIF(btrim(coalesce(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A valid invitation token is required';
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  SELECT * INTO invitation
  FROM public.erp_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF invitation.id IS NULL THEN
    RAISE EXCEPTION 'This invitation is invalid';
  END IF;
  IF invitation.status = 'activated' THEN
    RAISE EXCEPTION 'This invitation has already been used';
  END IF;
  IF invitation.status = 'revoked' THEN
    RAISE EXCEPTION 'This invitation has been revoked';
  END IF;
  IF invitation.status = 'expired' OR invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  SELECT u.email, u.phone, u.email_confirmed_at, u.phone_confirmed_at
  INTO v_email, v_phone, v_email_confirmed_at, v_phone_confirmed_at
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF invitation.email IS NOT NULL THEN
    IF lower(coalesce(v_email, '')) <> lower(invitation.email) THEN
      RAISE EXCEPTION 'Sign in with the email address that received this invitation';
    END IF;
    IF v_email_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Verify your email address before activating this invitation';
    END IF;
  END IF;

  IF invitation.phone IS NOT NULL THEN
    IF regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g') <> invitation.phone THEN
      RAISE EXCEPTION 'Sign in with the phone number that received this invitation';
    END IF;
    IF v_phone_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Verify your phone number before activating this invitation';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.erp_memberships WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'This identity already has an ERP account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = invitation.branch_id
      AND b.restaurant_id = invitation.restaurant_id
      AND coalesce(b.is_active, true)
      AND coalesce(r.is_active, true)
  ) THEN
    RAISE EXCEPTION 'The organization or branch assigned by this invitation is no longer active';
  END IF;

  SELECT public.erp_default_permissions(invitation.role)
      || coalesce(rp.permissions, '{}'::jsonb)
      || coalesce(invitation.permissions, '{}'::jsonb)
  INTO v_permissions
  FROM (SELECT 1) AS seed
  LEFT JOIN public.erp_role_permissions rp
    ON rp.restaurant_id = invitation.restaurant_id AND rp.role = invitation.role;

  INSERT INTO public.profiles (
    id, email, full_name, role, phone, approval_status, restaurant_id, organization_id,
    branch_id, branch, tenant_id, permissions, is_active, approved_at, approved_by, created_by
  ) VALUES (
    auth.uid(), v_email, invitation.full_name, invitation.role, coalesce(v_phone, invitation.phone),
    'approved', invitation.restaurant_id, invitation.restaurant_id, invitation.branch_id,
    (SELECT branch_key FROM public.branches WHERE id = invitation.branch_id),
    invitation.restaurant_id::text, v_permissions, true, now(), invitation.created_by,
    coalesce(v_email, invitation.phone)
  );

  INSERT INTO public.erp_memberships (
    user_id, email, full_name, phone, role, status, restaurant_id, branch_id,
    permissions, registration_data, approved_at, approved_by
  ) VALUES (
    auth.uid(), v_email, invitation.full_name, coalesce(v_phone, invitation.phone), invitation.role,
    'approved', invitation.restaurant_id, invitation.branch_id, v_permissions,
    jsonb_build_object('onboarding', 'owner_invitation', 'invitation_id', invitation.id),
    now(), invitation.created_by
  );

  INSERT INTO public.branch_assignments (
    user_id, restaurant_id, organization_id, branch_id, role, assigned_by, is_primary, active
  ) VALUES (
    auth.uid(), invitation.restaurant_id, invitation.restaurant_id, invitation.branch_id,
    invitation.role, invitation.created_by, true, true
  )
  ON CONFLICT (user_id, branch_id) DO UPDATE
    SET restaurant_id = EXCLUDED.restaurant_id,
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        assigned_by = EXCLUDED.assigned_by,
        is_primary = true,
        active = true,
        updated_at = now();

  -- Preserve the legacy operational records expected by driver and supplier pages.
  IF invitation.role = 'supplier' THEN
    SELECT s.id INTO v_linked_entity
    FROM public.suppliers s
    WHERE s.restaurant_id = invitation.restaurant_id
      AND (
        (v_email IS NOT NULL AND lower(coalesce(s.email, '')) = lower(v_email))
        OR (invitation.phone IS NOT NULL AND regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g') = invitation.phone)
      )
    LIMIT 1;

    IF v_linked_entity IS NULL THEN
      INSERT INTO public.suppliers (
        restaurant_id, branch_id, tenant_id, name, contact_person, phone, email, status, created_by
      ) VALUES (
        invitation.restaurant_id, invitation.branch_id, invitation.restaurant_id::text,
        invitation.full_name, invitation.full_name, coalesce(v_phone, invitation.phone), v_email,
        true, coalesce(v_email, invitation.phone)
      ) RETURNING id INTO v_linked_entity;
    END IF;
  ELSIF invitation.role = 'driver' THEN
    SELECT d.id INTO v_linked_entity
    FROM public.drivers d
    WHERE d.restaurant_id = invitation.restaurant_id
      AND (
        (v_email IS NOT NULL AND lower(coalesce(d.email, '')) = lower(v_email))
        OR (invitation.phone IS NOT NULL AND regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g') = invitation.phone)
      )
    LIMIT 1;

    IF v_linked_entity IS NULL THEN
      INSERT INTO public.drivers (
        restaurant_id, branch_id, tenant_id, full_name, phone, email, status, is_active, created_by
      ) VALUES (
        invitation.restaurant_id, invitation.branch_id, invitation.restaurant_id::text,
        invitation.full_name, coalesce(v_phone, invitation.phone), v_email,
        'active', true, coalesce(v_email, invitation.phone)
      ) RETURNING id INTO v_linked_entity;
    END IF;
  END IF;

  IF v_linked_entity IS NOT NULL THEN
    UPDATE public.erp_memberships
    SET linked_entity_id = v_linked_entity, updated_at = now()
    WHERE user_id = auth.uid();
  END IF;

  UPDATE public.erp_invitations
  SET status = 'activated', activated_by = auth.uid(), activated_at = now()
  WHERE id = invitation.id;

  INSERT INTO public.audit_logs (
    restaurant_id, branch_id, tenant_id, user_email, user_name,
    action, entity_type, entity_id, old_values, new_values, created_by
  ) VALUES (
    invitation.restaurant_id, invitation.branch_id, invitation.restaurant_id::text,
    v_email, invitation.full_name, 'invitation_activated', 'erp_invitation', invitation.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'activated', 'role', invitation.role, 'user_id', auth.uid()),
    coalesce(v_email, invitation.phone)
  );

  v_dashboard := CASE invitation.role
    WHEN 'general_manager' THEN '/gm-dashboard'
    WHEN 'manager' THEN '/manager-dashboard'
    WHEN 'employee' THEN '/employee-dashboard'
    WHEN 'driver' THEN '/driver-dashboard'
    WHEN 'kitchen' THEN '/kitchen-dashboard'
    WHEN 'supplier' THEN '/supplier-portal'
    ELSE '/erp-login'
  END;

  RETURN jsonb_build_object(
    'status', 'activated',
    'role', invitation.role,
    'dashboard', v_dashboard,
    'organization_id', invitation.restaurant_id,
    'branch_id', invitation.branch_id
  );
END;
$function$;

-- ── 5. Auth trigger: owner setup or a valid invitation token only ─────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  requested_role text;
  requested_restaurant uuid;
  requested_branch uuid;
  created_restaurant uuid;
  created_branch uuid;
  member_name text;
  member_phone text;
  company_name text;
  branch_name text;
  invitation_token text;
  invitation_hash text;
  invitation public.erp_invitations;
BEGIN
  invitation_token := NULLIF(btrim(coalesce(NEW.raw_user_meta_data->>'invitation_token', '')), '');
  requested_role := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));

  -- A non-owner account is never provisioned here. The authenticated activation
  -- RPC creates its profile, membership, and branch assignment only after identity
  -- confirmation. The token is stripped from auth metadata and never persisted.
  IF invitation_token IS NOT NULL THEN
    invitation_hash := encode(extensions.digest(invitation_token, 'sha256'), 'hex');
    SELECT * INTO invitation
    FROM public.erp_invitations
    WHERE token_hash = invitation_hash
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;

    IF invitation.id IS NULL THEN
      RAISE EXCEPTION 'A current, valid owner invitation is required to create this account';
    END IF;
    IF invitation.email IS NOT NULL
       AND lower(coalesce(NEW.email, '')) <> lower(invitation.email) THEN
      RAISE EXCEPTION 'Use the email address assigned by the owner invitation';
    END IF;
    IF invitation.phone IS NOT NULL
       AND regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g') <> invitation.phone THEN
      RAISE EXCEPTION 'Use the phone number assigned by the owner invitation';
    END IF;

    NEW.raw_user_meta_data :=
      (coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
        - 'invitation_token' - 'role' - 'restaurant_id' - 'branch_id')
      || jsonb_build_object('invitation_pending', true);
    RETURN NEW;
  END IF;

  IF requested_role <> 'owner' THEN
    RAISE EXCEPTION 'Non-owner accounts are invitation-only. Ask an organization owner to send an invitation.';
  END IF;

  member_name := btrim(coalesce(NEW.raw_user_meta_data->>'full_name', ''));
  member_phone := NULLIF(btrim(coalesce(NEW.raw_user_meta_data->>'phone', '')), '');
  company_name := btrim(coalesce(NEW.raw_user_meta_data->>'company_name', member_name || ' Company'));
  branch_name := btrim(coalesce(NEW.raw_user_meta_data->>'branch_name', 'Main Branch'));

  IF member_name = '' OR company_name = '' OR branch_name = '' THEN
    RAISE EXCEPTION 'Owner setup requires a name, organization name, and initial branch';
  END IF;

  INSERT INTO public.restaurants (
    org_id, name, created_by, business_mode, business_type, tenant_id, branches, address, currency
  ) VALUES (
    NEW.email, company_name, NEW.email,
    CASE WHEN coalesce(NEW.raw_user_meta_data->>'business_type', 'restaurant') IN ('retail', 'pharmacy', 'wholesale')
      THEN 'retail'::business_mode_type ELSE 'restaurant'::business_mode_type END,
    coalesce(nullif(NEW.raw_user_meta_data->>'business_type', ''), 'restaurant'),
    NEW.id::text, '[]'::jsonb,
    NULLIF(btrim(coalesce(NEW.raw_user_meta_data->>'address', '')), ''),
    coalesce(nullif(NEW.raw_user_meta_data->>'currency_symbol', ''), '$')
  ) RETURNING id INTO created_restaurant;

  INSERT INTO public.branches (
    restaurant_id, branch_key, name, location, is_active, created_by, tenant_id
  ) VALUES (
    created_restaurant,
    'main-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    branch_name,
    NULLIF(btrim(coalesce(NEW.raw_user_meta_data->>'branch_location', '')), ''),
    true, NEW.email, NEW.id::text
  ) RETURNING id INTO created_branch;

  UPDATE public.restaurants
  SET branch_id = created_branch,
      restaurant_id = created_restaurant,
      branches = jsonb_build_array(jsonb_build_object(
        'id', created_branch,
        'key', (SELECT branch_key FROM public.branches WHERE id = created_branch),
        'branch_key', (SELECT branch_key FROM public.branches WHERE id = created_branch),
        'label', branch_name,
        'name', branch_name,
        'is_active', true
      ))
  WHERE id = created_restaurant;

  requested_restaurant := created_restaurant;
  requested_branch := created_branch;

  INSERT INTO public.profiles (
    id, email, full_name, role, phone, approval_status, restaurant_id, organization_id,
    branch_id, branch, tenant_id, permissions, is_active, approved_at, created_by
  ) VALUES (
    NEW.id, NEW.email, member_name, 'owner', member_phone, 'approved',
    requested_restaurant, requested_restaurant, requested_branch,
    (SELECT branch_key FROM public.branches WHERE id = requested_branch),
    requested_restaurant::text, public.erp_default_permissions('owner'), true, now(), NEW.email
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    approval_status = EXCLUDED.approval_status,
    restaurant_id = EXCLUDED.restaurant_id,
    organization_id = EXCLUDED.organization_id,
    branch_id = EXCLUDED.branch_id,
    branch = EXCLUDED.branch,
    tenant_id = EXCLUDED.tenant_id,
    permissions = EXCLUDED.permissions,
    is_active = true,
    approved_at = EXCLUDED.approved_at,
    updated_date = now();

  INSERT INTO public.erp_memberships (
    user_id, email, full_name, phone, role, status, restaurant_id, branch_id,
    permissions, registration_data, approved_at
  ) VALUES (
    NEW.id, NEW.email, member_name, member_phone, 'owner', 'approved',
    requested_restaurant, requested_branch, public.erp_default_permissions('owner'),
    coalesce(NEW.raw_user_meta_data, '{}'::jsonb), now()
  ) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.branch_assignments (
    user_id, restaurant_id, organization_id, branch_id, role, is_primary, active
  ) VALUES (
    NEW.id, requested_restaurant, requested_restaurant, requested_branch, 'owner', true, true
  ) ON CONFLICT (user_id, branch_id) DO UPDATE
    SET restaurant_id = EXCLUDED.restaurant_id,
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        is_primary = true,
        active = true,
        updated_at = now();

  RETURN NEW;
END;
$function$;

-- ── 6. Remove public enumeration and legacy self-registration permissions ─────
DROP POLICY IF EXISTS restaurants_public_read_active ON public.restaurants;
DROP POLICY IF EXISTS "Allow public insert for registration" ON public.restaurants;
DROP POLICY IF EXISTS branches_public_read_active ON public.branches;

DROP POLICY IF EXISTS erp_memberships_insert_public ON public.erp_memberships;
DROP POLICY IF EXISTS erp_memberships_owner_manage ON public.erp_memberships;
DROP POLICY IF EXISTS erp_memberships_delete_owner ON public.erp_memberships;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_owner ON public.profiles;

DROP POLICY IF EXISTS "Anyone can register" ON public.erp_registrations;
DROP POLICY IF EXISTS "Owners can manage registrations for their restaurants" ON public.erp_registrations;
DROP POLICY IF EXISTS "Users can view their own registrations" ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_insert_public ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_own_access ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_owner_access ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_select_own ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_select_owner_gm ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_update_owner ON public.erp_registrations;
DROP POLICY IF EXISTS erp_reg_delete_owner ON public.erp_registrations;

-- Retire every legacy role-specific invitation table and its scoped policies.
DROP POLICY IF EXISTS erp_scope_select ON public.manager_invites;
DROP POLICY IF EXISTS erp_scope_insert ON public.manager_invites;
DROP POLICY IF EXISTS erp_scope_update ON public.manager_invites;
DROP POLICY IF EXISTS erp_scope_delete ON public.manager_invites;
DROP POLICY IF EXISTS erp_scope_select ON public.employee_invites;
DROP POLICY IF EXISTS erp_scope_insert ON public.employee_invites;
DROP POLICY IF EXISTS erp_scope_update ON public.employee_invites;
DROP POLICY IF EXISTS erp_scope_delete ON public.employee_invites;
DROP POLICY IF EXISTS erp_scope_select ON public.driver_invites;
DROP POLICY IF EXISTS erp_scope_insert ON public.driver_invites;
DROP POLICY IF EXISTS erp_scope_update ON public.driver_invites;
DROP POLICY IF EXISTS erp_scope_delete ON public.driver_invites;

REVOKE ALL ON TABLE public.erp_registrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.manager_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.employee_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.driver_invites FROM anon, authenticated;

-- Legacy decision logic accepted public self-registration records. It is no
-- longer executable from the application once invitation-only provisioning is active.
REVOKE ALL ON FUNCTION public.erp_decide_membership(uuid, text, uuid, jsonb, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_erp_invitation(text, uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_erp_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_erp_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_erp_owned_organizations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_erp_owned_branches(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_erp_invitation(text, uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_erp_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_erp_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_erp_owned_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_erp_owned_branches(uuid) TO authenticated;

-- ── 7. Preserve approved legacy accounts; quarantine insecure pending flows ────
UPDATE public.profiles p
SET organization_id = m.restaurant_id,
    branch_id = coalesce(p.branch_id, m.branch_id),
    approval_status = 'approved',
    is_active = true,
    updated_date = now()
FROM public.erp_memberships m
WHERE m.user_id = p.id
  AND m.status = 'approved'
  AND m.restaurant_id IS NOT NULL;

INSERT INTO public.branch_assignments (
  user_id, restaurant_id, organization_id, branch_id, role, assigned_by, is_primary, active
)
SELECT m.user_id, m.restaurant_id, m.restaurant_id, m.branch_id, m.role, m.approved_by, true, true
FROM public.erp_memberships m
JOIN public.branches b ON b.id = m.branch_id AND b.restaurant_id = m.restaurant_id
WHERE m.status = 'approved'
  AND m.branch_id IS NOT NULL
ON CONFLICT (user_id, branch_id) DO UPDATE
  SET restaurant_id = EXCLUDED.restaurant_id,
      organization_id = EXCLUDED.organization_id,
      role = EXCLUDED.role,
      is_primary = true,
      active = true,
      updated_at = now();

-- Pending accounts were created by a workflow that did not prove owner issuance.
-- They are retained for audit but cannot be activated; the owner must issue a new,
-- time-limited invitation from the Owner Dashboard.
UPDATE public.erp_memberships
SET status = 'rejected',
    rejection_reason = 'Legacy self-registration retired. The organization owner must issue a secure invitation.',
    updated_at = now()
WHERE role <> 'owner'
  AND status = 'pending';

UPDATE public.profiles p
SET approval_status = 'rejected',
    is_active = false,
    rejection_reason = 'Legacy self-registration retired. Ask the organization owner for a secure invitation.',
    updated_date = now()
FROM public.erp_memberships m
WHERE m.user_id = p.id
  AND m.status = 'rejected'
  AND m.rejection_reason LIKE 'Legacy self-registration retired.%';

UPDATE public.erp_registrations
SET status = 'rejected',
    rejection_reason = 'Legacy public registration retired. The organization owner must issue a secure invitation.',
    updated_at = now()
WHERE status = 'pending';

UPDATE public.manager_invites SET status = 'revoked', updated_date = now() WHERE status = 'pending';
UPDATE public.employee_invites SET status = 'revoked', updated_date = now() WHERE status = 'pending';
UPDATE public.driver_invites SET status = 'revoked', updated_date = now() WHERE status = 'pending';

COMMIT;
