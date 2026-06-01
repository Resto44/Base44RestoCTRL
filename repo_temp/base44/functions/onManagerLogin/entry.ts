import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Called when a new User is created (first login after invite).
 * Checks for a pending ManagerInvite and applies role=manager + branch to the User record.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data } = await req.json();

    const userEmail = data?.email;
    if (!userEmail) return Response.json({ skipped: 'no email' });

    // Look for a pending invite for this email
    const invites = await base44.asServiceRole.entities.ManagerInvite.filter({
      email: userEmail.toLowerCase(),
      status: 'pending',
    });

    if (invites.length === 0) return Response.json({ skipped: 'no pending invite' });

    // Pick the most recent invite
    const invite = invites.sort((a, b) => b.created_date > a.created_date ? 1 : -1)[0];

    // Update User: set role=manager and branch
    await base44.asServiceRole.entities.User.update(data.id, {
      role: 'manager',
      branch: invite.branch_key,
      branch_label: invite.branch_label,
    });

    // Mark invite as accepted
    await base44.asServiceRole.entities.ManagerInvite.update(invite.id, {
      status: 'accepted',
    });

    console.log(`[onManagerLogin] Applied manager role to ${userEmail} for branch ${invite.branch_key}`);
    return Response.json({ success: true, branch: invite.branch_key });
  } catch (error) {
    console.error('[onManagerLogin]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});