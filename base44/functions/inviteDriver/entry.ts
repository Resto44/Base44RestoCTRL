import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allowedRoles = ['owner', 'admin', 'restaurant_admin', 'manager'];
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ error: 'Only managers and owners can invite drivers' }, { status: 403 });
    }

    const { email, driver_name, phone, branch_key, branch_label, restaurant_name, restaurant_id } = await req.json();

    if (!email || !branch_key) {
      return Response.json({ error: 'email and branch_key are required' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    // 1. Invite as standard "user" role in the platform (NOT "driver" — that's internal only)
    try {
      await base44.users.inviteUser(emailLower, 'user');
    } catch (inviteErr) {
      // If already registered, that's fine — they'll just follow the link
      console.warn('[inviteDriver] platform invite skipped:', inviteErr.message);
    }

    // 2. Generate secure token (72h expiry)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // 3. Revoke existing pending invites for this email+branch
    const existing = await base44.asServiceRole.entities.DriverInvite.filter({ email: emailLower, branch_key });
    for (const inv of existing) {
      await base44.asServiceRole.entities.DriverInvite.update(inv.id, { status: 'revoked' });
    }

    // 4. Create DriverInvite record
    const invite = await base44.asServiceRole.entities.DriverInvite.create({
      email: emailLower,
      driver_name: driver_name || '',
      phone: phone || '',
      branch_key,
      branch_label: branch_label || '',
      restaurant_name: restaurant_name || '',
      restaurant_id: restaurant_id || '',
      owner_email: user.email,
      invite_token: token,
      token_expires_at: expiresAt,
      status: 'pending',
    });

    const appUrl = 'https://rest-ctrl-flow.base44.app';
    const inviteLink = `${appUrl}/driver-invite?token=${token}`;

    // 5. Send branded email
    const driverDisplayName = driver_name || emailLower;
    const emailBody = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
      <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px">
        <div style="font-size:48px;margin-bottom:8px">🚴</div>
        <h1 style="color:white;margin:0;font-size:22px;font-weight:800">Driver Portal Invitation</h1>
        <p style="color:#93c5fd;margin:8px 0 0">Restaurant Manager Pro</p>
      </div>
      <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">Hello ${driverDisplayName}! 👋</h2>
      <p style="color:#64748b;margin-bottom:16px">
        You have been invited to join as a <strong>Delivery Driver</strong> at <strong>${restaurant_name || 'our restaurant'}</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:14px;color:#475569">
          🏪 <strong>Restaurant:</strong> ${restaurant_name || '—'}<br/>
          📍 <strong>Branch:</strong> ${branch_label || branch_key}<br/>
          👤 <strong>Role:</strong> Delivery Driver<br/>
          🔒 <strong>Access:</strong> Driver Portal Only
        </p>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${inviteLink}" style="display:inline-block;background:#1d4ed8;color:white;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;letter-spacing:0.5px">
          🚀 Activate Driver Account
        </a>
      </div>
      <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:12px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#713f12">
          ⚡ <strong>Quick steps:</strong> Click the button → Create your password → Access your driver dashboard
        </p>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center">This link expires in 72 hours · Invited by ${user.full_name || user.email}</p>
    </div>`;

    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: emailLower,
        subject: `🚴 You're invited as a Delivery Driver — ${restaurant_name || 'Restaurant'}`,
        body: emailBody,
        from_name: 'Restaurant Manager Pro',
      });
      emailSent = true;
      await base44.asServiceRole.entities.DriverInvite.update(invite.id, { email_sent: true });
    } catch (emailErr) {
      console.warn('[inviteDriver] email skipped:', emailErr.message);
    }

    return Response.json({
      success: true,
      invite_id: invite.id,
      invite_link: inviteLink,
      token,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('[inviteDriver]', error);
    return Response.json({ error: error.message || 'Invitation failed' }, { status: 500 });
  }
});