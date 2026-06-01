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
    if (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'restaurant_admin') {
      return Response.json({ error: 'Only owners can invite managers' }, { status: 403 });
    }

    const { email, branch_key, branch_label, restaurant_name, restaurant_id, language } = await req.json();

    if (!email || !branch_key) {
      return Response.json({ error: 'email and branch_key are required' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    // 1. Platform invite — creates account + sends platform onboarding email
    await base44.users.inviteUser(emailLower, 'user');

    // 2. Generate secure token (expires in 72 hours)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // 3. Upsert ManagerInvite — delete old ones first
    const existing = await base44.asServiceRole.entities.ManagerInvite.filter({ email: emailLower });
    for (const inv of existing) {
      await base44.asServiceRole.entities.ManagerInvite.delete(inv.id);
    }
    const invite = await base44.asServiceRole.entities.ManagerInvite.create({
      email: emailLower,
      branch_key,
      branch_label: branch_label || '',
      owner_email: user.email,
      restaurant_id: restaurant_id || '',
      restaurant_name: restaurant_name || '',
      status: 'pending',
      invite_token: token,
      token_expires_at: expiresAt,
    });

    const appUrl = 'https://rest-ctrl-flow.base44.app';
    const inviteLink = `${appUrl}/invite?token=${token}`;

    // 4. Best-effort branded email
    const lang = language || 'en';
    const subjects = {
      en: `You've been invited to manage: ${branch_label}`,
      ar: `دُعيت لإدارة فرع: ${branch_label}`,
      fa: `دعوت به مدیریت شعبه: ${branch_label}`,
    };
    const bodies = {
      en: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
        <div style="background:#1d4ed8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:22px">🍽️ Restaurant Manager Pro</h1>
        </div>
        <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">You've been invited!</h2>
        <p style="color:#64748b;margin-bottom:16px">
          <strong>${user.full_name || user.email}</strong> has invited you to manage branch <strong>${branch_label}</strong>${restaurant_name ? ` at ${restaurant_name}` : ''}.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;color:#475569">
            📍 <strong>Branch:</strong> ${branch_label}<br/>
            👤 <strong>Role:</strong> Branch Manager<br/>
            🔒 <strong>Access:</strong> This branch only
          </p>
        </div>
        <a href="${inviteLink}" style="display:inline-block;background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
          Accept Invitation →
        </a>
        <p style="margin-top:16px;font-size:12px;color:#94a3b8">This link expires in 72 hours. Invited by ${user.email}</p>
      </div>`,
      ar: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;direction:rtl;text-align:right">
        <div style="background:#1d4ed8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:22px">🍽️ Restaurant Manager Pro</h1>
        </div>
        <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">تمت دعوتك!</h2>
        <p style="color:#64748b;margin-bottom:16px">
          دعاك <strong>${user.full_name || user.email}</strong> لإدارة فرع <strong>${branch_label}</strong>${restaurant_name ? ` في ${restaurant_name}` : ''}.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;color:#475569">
            📍 <strong>الفرع:</strong> ${branch_label}<br/>
            👤 <strong>الدور:</strong> مدير الفرع<br/>
            🔒 <strong>الصلاحية:</strong> هذا الفرع فقط
          </p>
        </div>
        <a href="${inviteLink}" style="display:inline-block;background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
          قبول الدعوة ←
        </a>
        <p style="margin-top:16px;font-size:12px;color:#94a3b8">ينتهي الرابط خلال 72 ساعة. دعوة من ${user.email}</p>
      </div>`,
      fa: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;direction:rtl;text-align:right">
        <div style="background:#1d4ed8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:22px">🍽️ Restaurant Manager Pro</h1>
        </div>
        <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">دعوت شدید!</h2>
        <p style="color:#64748b;margin-bottom:16px">
          <strong>${user.full_name || user.email}</strong> شما را برای مدیریت شعبه <strong>${branch_label}</strong>${restaurant_name ? ` در ${restaurant_name}` : ''} دعوت کرده است.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;color:#475569">
            📍 <strong>شعبه:</strong> ${branch_label}<br/>
            👤 <strong>نقش:</strong> مدیر شعبه<br/>
            🔒 <strong>دسترسی:</strong> فقط این شعبه
          </p>
        </div>
        <a href="${inviteLink}" style="display:inline-block;background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
          قبول دعوت ←
        </a>
        <p style="margin-top:16px;font-size:12px;color:#94a3b8">این لینک ۷۲ ساعت معتبر است. دعوت از ${user.email}</p>
      </div>`,
    };

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: emailLower,
        subject: subjects[lang] || subjects.en,
        body: bodies[lang] || bodies.en,
        from_name: 'Restaurant Manager Pro',
      });
    } catch (emailErr) {
      console.warn('[inviteManager] branded email skipped:', emailErr.message);
    }

    return Response.json({ success: true, invite_id: invite.id, invite_link: inviteLink, token });
  } catch (error) {
    console.error('[inviteManager]', error);
    return Response.json({ error: error.message || 'Invitation failed' }, { status: 500 });
  }
});