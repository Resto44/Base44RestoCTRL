-- ============================================================
-- Fix: activate_erp_invitation now returns branch_name in the JSON response
-- so ERPRegister.jsx can pre-populate sessionStorage with the branch name,
-- allowing the dashboard to skip BranchSelector on first login.
-- ============================================================

CREATE OR REPLACE FUNCTION public.activate_erp_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
SET row_security TO 'off'
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
  v_branch_name text;
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

  -- Fetch branch name for sessionStorage pre-population on the client
  SELECT name INTO v_branch_name FROM public.branches WHERE id = invitation.branch_id;

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
    SET restaurant_id  = EXCLUDED.restaurant_id,
        organization_id = EXCLUDED.organization_id,
        role           = EXCLUDED.role,
        assigned_by    = EXCLUDED.assigned_by,
        is_primary     = true,
        active         = true,
        updated_at     = now();

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
        restaurant_id, branch_id, tenant_id, full_name, phone, email,
        status, is_active, created_by
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
    WHEN 'manager'         THEN '/manager-dashboard'
    WHEN 'employee'        THEN '/employee-dashboard'
    WHEN 'driver'          THEN '/driver-dashboard'
    WHEN 'kitchen'         THEN '/kitchen-dashboard'
    WHEN 'supplier'        THEN '/supplier-portal'
    ELSE '/erp-login'
  END;

  RETURN jsonb_build_object(
    'status',        'activated',
    'role',          invitation.role,
    'dashboard',     v_dashboard,
    'organization_id', invitation.restaurant_id,
    'branch_id',     invitation.branch_id,
    'branch_name',   v_branch_name
  );
END;
$function$;
