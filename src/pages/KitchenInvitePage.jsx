import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ChefHat } from 'lucide-react';

async function waitForAuth(maxAttempts = 12, delayMs = 700) {
  for (let i = 0; i < maxAttempts; i++) {
    const authed = await base44.auth.isAuthenticated();
    if (authed) return true;
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

export default function KitchenInvitePage() {
  const [state, setState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteData, setInviteData] = useState(null);
  const hasRun = useRef(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    startFlow();
  }, []);

  const startFlow = async () => {
    setState('loading');
    if (!token) { setErrorMsg('No invitation token found.'); setState('error'); return; }

    const storedToken = sessionStorage.getItem('pending_kitchen_invite_token') || localStorage.getItem('pending_kitchen_invite_token');
    const returningFromLogin = storedToken === token;

    let authed = await base44.auth.isAuthenticated();
    if (!authed && returningFromLogin) authed = await waitForAuth(12, 700);

    if (authed) {
      sessionStorage.removeItem('pending_kitchen_invite_token');
      localStorage.removeItem('pending_kitchen_invite_token');
    }

    await callAccept(authed);
  };

  const callAccept = async (authed) => {
    setState(authed ? 'activating' : 'loading');
    const res = await base44.functions.invoke('acceptEmployeeInvite', { token });
    const data = res?.data;
    if (!data) { setErrorMsg('No response from server.'); setState('error'); return; }
    if (data.error) {
      const errMap = { invalid_token: 'Invalid or already used link.', expired: 'This link has expired.', revoked: 'Invitation was revoked.' };
      setErrorMsg(errMap[data.error] || data.message || 'Invitation error.'); setState('error'); return;
    }
    if (data.pending_auth) { setInviteData(data); setState('pending_auth'); return; }
    if (data.success) {
      setInviteData(data); setState('success');
      setTimeout(() => window.location.replace('/kitchen'), 2000);
    }
  };

  const handleLogin = () => {
    sessionStorage.setItem('pending_kitchen_invite_token', token);
    localStorage.setItem('pending_kitchen_invite_token', token);
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-white font-black text-xl">Kitchen Staff Portal</h1>
            <p className="text-amber-200 text-sm mt-1">Restaurant Manager Pro</p>
          </div>

          <div className="p-6 text-center">
            {(state === 'loading' || state === 'activating') && (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
                <p className="font-semibold text-slate-700">{state === 'activating' ? 'Activating account…' : 'Validating invitation…'}</p>
              </div>
            )}

            {state === 'pending_auth' && (
              <div className="space-y-5">
                <div className="text-4xl">👋</div>
                <div>
                  <h2 className="font-black text-xl text-slate-800">You're Invited!</h2>
                  {inviteData?.employee_name && <p className="text-slate-600 mt-1">Hello, <strong>{inviteData.employee_name}</strong>!</p>}
                </div>
                {inviteData?.restaurant_name && (
                  <div className="bg-amber-50 rounded-2xl p-4 text-left">
                    <p className="text-sm text-slate-600">🏪 <strong>{inviteData.restaurant_name}</strong></p>
                    <p className="text-sm text-slate-600 mt-1">👨‍🍳 Role: <strong>Kitchen Staff</strong></p>
                  </div>
                )}
                <p className="text-sm text-slate-500">Sign in or create your account to access the kitchen portal.</p>
                <Button className="w-full h-12 text-base font-bold rounded-2xl bg-amber-500 hover:bg-amber-600" onClick={handleLogin}>
                  Sign In / Create Account
                </Button>
              </div>
            )}

            {state === 'success' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <h2 className="font-black text-xl text-slate-800">Account Activated! 🎉</h2>
                <p className="text-sm text-slate-500">Redirecting to kitchen dashboard…</p>
                <Button className="w-full" onClick={() => window.location.replace('/kitchen')}>Open Kitchen Dashboard</Button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-9 h-9 text-red-500" />
                </div>
                <h2 className="font-black text-xl text-slate-800">Invitation Error</h2>
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{errorMsg}</p>
                <Button variant="outline" size="sm" onClick={() => { hasRun.current = false; startFlow(); }}>Try Again</Button>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-4">Restaurant Manager Pro · Kitchen Staff Onboarding</p>
      </div>
    </div>
  );
}