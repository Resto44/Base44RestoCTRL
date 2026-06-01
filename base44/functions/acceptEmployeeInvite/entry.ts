import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) return Response.json({ error: 'token is required' }, { status: 400 });

    // 1. Look up invite
    const invites = await base44.asServiceRole.entities.EmployeeInvite.filter({ invite_token: token });
    if (!invites || invites.length === 0) {
      return Response.json({ error: 'invalid_token', message: 'Invite not found or already used.' }, { status: 404 });
    }

    const invite = invites[0];

    // 2. Validate state
    if (invite.status === 'revoked') {
      return Response.json({ error: 'revoked', message: 'This invitation has been revoked.' }, { status: 410 });
    }
    if (invite.token_expires_at && new Date(invite.token_expires_at) < new Date()) {
      await base44.asServiceRole.entities.EmployeeInvite.update(invite.id, { status: 'expired' });
      return Response.json({ error: 'expired', message: 'This invite link has expired. Please ask your manager to send a new one.' }, { status: 410 });
    }

    // 3. Return invite metadata if user not authenticated
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({
        pending_auth: true,
        email: invite.email,
        employee_name: invite.employee_name,
        position: invite.position,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
      });
    }

    // Already accepted — allow re-entry
    if (invite.status === 'accepted') {
      return Response.json({
        success: true,
        already_accepted: true,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
      });
    }

    // 4. Apply EMPLOYEE role + branch to user
    await base44.asServiceRole.entities.User.update(me.id, {
      role: 'employee',
      branch: invite.branch_key,
      branch_label: invite.branch_label,
      owner_email: invite.owner_email,
    });

    // 5. Create or link Employee record
    let employeeRecordId = invite.employee_record_id;
    if (!employeeRecordId) {
      const existingEmps = await base44.asServiceRole.entities.Employee.filter({ email: me.email });
      if (existingEmps.length > 0) {
        employeeRecordId = existingEmps[0].id;
        await base44.asServiceRole.entities.Employee.update(employeeRecordId, {
          branch: invite.branch_key,
          position: invite.position || existingEmps[0].position,
          is_active: true,
        });
      } else {
        const emp = await base44.asServiceRole.entities.Employee.create({
          full_name: invite.employee_name || me.full_name || me.email,
          email: me.email,
          branch: invite.branch_key,
          position: invite.position || 'Staff',
          is_active: true,
          phone: invite.phone || '',
        });
        employeeRecordId = emp.id;
      }
    }

    // 6. Mark invite accepted
    await base44.asServiceRole.entities.EmployeeInvite.update(invite.id, {
      status: 'accepted',
      employee_record_id: employeeRecordId,
    });

    console.log(`[acceptEmployeeInvite] ${me.email} → employee, branch=${invite.branch_key}`);

    return Response.json({
      success: true,
      branch_key: invite.branch_key,
      branch_label: invite.branch_label,
      restaurant_name: invite.restaurant_name,
      position: invite.position,
    });
  } catch (error) {
    console.error('[acceptEmployeeInvite]', error);
    return Response.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
});