import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * acceptInvite — called from InvitePage after user is authenticated.
 * Uses service role to bypass ManagerInvite RLS (owner created the record, not the manager).
 * 
 * Input: { token }
 * Output: { success, branch_key, branch_label, restaurant_name, owner_email } | { error }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse body
    const body = await req.json();
    const { token } = body || {};

    if (!token) {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    // 1. Look up invite via service role (bypasses RLS — owner created it, not manager)
    const invites = await base44.asServiceRole.entities.ManagerInvite.filter({ invite_token: token });

    if (!invites || invites.length === 0) {
      return Response.json({ error: 'invalid_token', message: 'Invite not found or already used.' }, { status: 404 });
    }

    const invite = invites[0];

    // 2. Validate state
    if (invite.status === 'revoked') {
      return Response.json({ error: 'revoked', message: 'This invitation has been revoked.' }, { status: 410 });
    }
    if (invite.status === 'accepted') {
      // Already accepted — return invite data so UI can still proceed to dashboard
      return Response.json({
        success: true,
        already_accepted: true,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
        owner_email: invite.owner_email,
      });
    }
    if (invite.token_expires_at && new Date(invite.token_expires_at) < new Date()) {
      return Response.json({ error: 'expired', message: 'This invite link has expired. Please ask the owner to send a new one.' }, { status: 410 });
    }

    // 3. Require authenticated user
    const me = await base44.auth.me();
    if (!me) {
      // Return invite metadata without accepting — UI will prompt login
      return Response.json({
        pending_auth: true,
        branch_key: invite.branch_key,
        branch_label: invite.branch_label,
        restaurant_name: invite.restaurant_name,
        owner_email: invite.owner_email,
        email: invite.email,
      });
    }

    // 4. Apply manager role + branch to authenticated user (service role)
    await base44.asServiceRole.entities.User.update(me.id, {
      role: 'manager',
      branch: invite.branch_key,
      branch_label: invite.branch_label,
      owner_email: invite.owner_email,
      restaurant_id: invite.restaurant_id || '',
    });

    // 5. Mark invite accepted (service role)
    await base44.asServiceRole.entities.ManagerInvite.update(invite.id, { status: 'accepted' });

    console.log(`[acceptInvite] ${me.email} → manager, branch=${invite.branch_key}`);

    return Response.json({
      success: true,
      branch_key: invite.branch_key,
      branch_label: invite.branch_label,
      restaurant_name: invite.restaurant_name,
      owner_email: invite.owner_email,
    });
  } catch (error) {
    console.error('[acceptInvite]', error);
    return Response.json({ error: 'server_error', message: error.message }, { status: 500 });
  }
});