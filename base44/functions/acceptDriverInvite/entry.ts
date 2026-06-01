import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * acceptDriverInvite
 * Validates the driver invite token, applies DRIVER role + branch to the authenticated user,
 * creates/links Employee record, marks invite accepted.
 *
 * Input: { token }
 * Output: { success, branch_key, branch_label, restaurant_name } | { pending_auth, ... } | { error }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    // 1. Look up invite record
    const invites = await base44.asServiceRole.entities.DriverInvite.filter({ invite_token: token });

    if (!invites || invites.length === 0) {
      return Response.json({ error: 'invalid_token', message: 'Invite not found or already used.' }, { status: 404 });
    }

    const invite = invites[0];

    // 2. Validate state
    if (invite.status === 'revoked') {
      return Response.json({ error: 'revoked', message: 'This invitation has been revoked.' }, { status: 410 });
    }
    if (invite.token_expires_at && new Date(invite.token_expires_at) < new Date()) {
      await base44.asServiceRole.entities.DriverInvite.update(invite.id, { status: 'expired' });
      return Response.json({ error: 'expired', message: 'This invite link has expired. Please ask your manager to send a new one.' }, { status: 410 });
    }

    // 3. Return invite metadata if user is not yet authenticated (UI will redirect to login)
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({
        pending_auth: true,
        email: invite.email,
        driver_name: invite.driver_name,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
      });
    }

    // If already accepted, allow re-entry to driver portal
    if (invite.status === 'accepted') {
      return Response.json({
        success: true,
        already_accepted: true,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
      });
    }

    // 4. Apply DRIVER role + branch to user (internal role = 'driver', stored on User entity)
    await base44.asServiceRole.entities.User.update(me.id, {
      role: 'driver',
      branch: invite.branch_key,
      branch_label: invite.branch_label,
      owner_email: invite.owner_email,
    });

    // 5. Create or link Employee record for this driver
    let employeeId = invite.employee_id;
    if (!employeeId) {
      // Check if employee already exists by email
      const existingEmps = await base44.asServiceRole.entities.Employee.filter({ email: me.email });
      if (existingEmps.length > 0) {
        employeeId = existingEmps[0].id;
        // Update with driver flags
        await base44.asServiceRole.entities.Employee.update(employeeId, {
          is_driver: true,
          driver_status: 'active',
          branch: invite.branch_key,
        });
      } else {
        // Auto-create employee record
        const emp = await base44.asServiceRole.entities.Employee.create({
          full_name: invite.driver_name || me.full_name || me.email,
          email: me.email,
          branch: invite.branch_key,
          position: 'driver',
          is_driver: true,
          driver_status: 'active',
          is_active: true,
        });
        employeeId = emp.id;
      }
    }

    // 6. Mark invite accepted
    await base44.asServiceRole.entities.DriverInvite.update(invite.id, {
      status: 'accepted',
      employee_id: employeeId,
    });

    console.log(`[acceptDriverInvite] ${me.email} → driver, branch=${invite.branch_key}, employee=${employeeId}`);

    return Response.json({
      success: true,
      branch_key: invite.branch_key,
      branch_label: invite.branch_label,
      restaurant_name: invite.restaurant_name,
    });
  } catch (error) {
    console.error('[acceptDriverInvite]', error);
    return Response.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
});