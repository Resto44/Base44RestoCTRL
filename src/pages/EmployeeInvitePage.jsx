import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, UserRound } from 'lucide-react';

/**
 * Employee Invite Activation Page — /employee-invite?token=XXX
 * Mirrors DriverInvitePage with auth polling.
 */

async function waitForAuth(maxAttempts = 10, delayMs = 700) {
  for (let i = 0; i < maxAttempts; i++) {
    const authed = await base44.auth.isAuthenticated();
    if (authed) return true;
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

export default function EmployeeInvitePage() {
  const [state, setState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteData, setInviteData] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const hasRun = useRef(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const log = (msg) => {
    setDebugLog(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`]);
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    startFlow();
  }, []);

  const startFlow = async () => {
    setState('loading');

    if (!token) {
      setErrorMsg('No invitation token found. Please use the original invite link.');
      setState('error');
      return;
    }

    log(`Token: ${token.slice(0, 8)}…`);
    const storedToken = sessionStorage.getItem('pending_employee_invite_token') || localStorage.getItem('pending_employee_invite_token');
    const returningFromLogin = storedToken === token;

    let authed = await base44.auth.isAuthenticated();
    log(`Auth: ${authed}, returning: ${returningFromLogin}`);

    if (!authed && returningFromLogin) {
      log('Polling for auth after login redirect…');
      authed = await waitForAuth(12, 700);
      log(`Auth after poll: ${authed}`);
    }

    if (authed) {
      sessionStorage.removeItem('pending_employee_invite_token');
      localStorage.removeItem('pending_employee_invite_token');
    }

    await callAcceptInvite(authed);
  };

  const callAcceptInvite = async (authed) => {
    setState(authed ? 'activating' : 'loading');
    log(`Calling acceptEmployeeInvite (authed=${authed})…`);

    const res = await base44.functions.invoke('acceptEmployeeInvite', { token });
    const data = res?.data;
    log(`Response: ${JSON.stringify(data)}`);

    if (!data) {
      setErrorMsg('No response from server. Please try again.');
      setState('error');
      return;
    }
    if (data.error) {
      const errMap = {
        invalid_token: 'This invite link is invalid or has already been used.',
        expired: 'This invite link has expired. Please ask your manager to send a new one.',
        revoked: 'This invitation has been revoked.',
      };
      setErrorMsg(errMap[data.error] || data.message || 'Invitation error. Please contact your manager.');
      setState('error');
      return;
    }
    if (data.pending_auth) {
      sessionStorage.setItem('pending_employee_invite_token', token);
      setInviteData(data);
      setState('pending_auth');
      return;
    }
    if (data.success) {
      setInviteData(data);
      setState('success');
      log('Success — redirecting to /employee-dashboard in 2s');
      setTimeout(() => window.location.replace('/employee-dashboard'), 2000);
    }
  };

  const handleLogin = () => {
    log('Storing token and redirecting to login…');
    sessionStorage.setItem('pending_employee_invite_token', token);
    localStorage.setItem('pending_employee_invite_token', token);
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 px-6 pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserRound className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-white font-black text-xl">Employee Portal</h1>
            <p className="text-emerald-200 text-sm mt-1">Restaurant Manager Pro</p>
          </div>

          <div className="p-6 text-center">

            {(state === 'loading' || state === 'activating') && (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
                <p className="font-semibold text-slate-700">
                  {state === 'activating' ? 'Activating your account…' : 'Validating invitation…'}
                </p>
                <p className="text-sm text-slate-500">Please wait a moment</p>
              </div>
            )}

            {state === 'pending_auth' && (
              <div className="space-y-5">
                <div className="text-4xl">👋</div>
                <div>
                  <h2 className="font-black text-xl text-slate-800">You're Invited!</h2>
                  {inviteData?.employee_name && (
                    <p className="text-slate-600 mt-1">Hello, <strong>{inviteData.employee_name}</strong>!</p>
                  )}
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 text-left space-y-1.5">
                  {inviteData?.restaurant_name && (
                    <p className="text-sm text-slate-600">🏪 <strong>{inviteData.restaurant_name}</strong></p>
                  )}
                  <p className="text-sm text-slate-600">📍 Branch: <strong>{inviteData?.branch_label || inviteData?.branch_key}</strong></p>
                  {inviteData?.position && (
                    <p className="text-sm text-slate-600">💼 Position: <strong>{inviteData.position}</strong></p>
                  )}
                  {inviteData?.email && (
                    <p className="text-sm text-slate-600">📧 <strong>{inviteData.email}</strong></p>
                  )}
                  <p className="text-sm text-slate-600">👤 Role: <strong>Employee</strong></p>
                </div>
                <p className="text-sm text-slate-500">
                  Sign in or create your account to activate the employee portal.
                </p>
                <Button
                  className="w-full h-12 text-base font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleLogin}>
                  Sign In / Create Account
                </Button>
                <p className="text-xs text-slate-400">
                  Use the same email address to sign up — your employee role will be assigned automatically.
                </p>
              </div>
            )}

            {state === 'success' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-800">Account Activated! 🎉</h2>
                  {inviteData?.restaurant_name && (
                    <p className="text-slate-500 mt-1 text-sm">Welcome to <strong>{inviteData.restaurant_name}</strong></p>
                  )}
                  {inviteData?.position && (
                    <p className="text-slate-500 text-sm">Position: <strong>{inviteData.position}</strong></p>
                  )}
                </div>
                <p className="text-sm text-slate-500">Redirecting to your employee dashboard…</p>
                <div className="flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => window.location.replace('/employee-dashboard')}>
                  Open Employee Dashboard
                </Button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-9 h-9 text-red-500" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-800">Invitation Error</h2>
                  <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-xl p-3">{errorMsg}</p>
                </div>
                <p className="text-xs text-slate-400">
                  Contact your manager to get a fresh invitation link.
                </p>
                <Button variant="outline" size="sm" onClick={() => { hasRun.current = false; startFlow(); }}>
                  Try Again
                </Button>
              </div>
            )}

          </div>
        </div>

        {/* Debug panel */}
        <div className="mt-4 text-center">
          <button onClick={() => setShowDebug(v => !v)} className="text-slate-600 text-xs">
            {showDebug ? '▲ Hide Debug' : '· · ·'}
          </button>
          {showDebug && (
            <div className="mt-2 bg-black/50 rounded-lg p-3 text-left">
              <p className="text-slate-400 text-xs font-bold mb-1">Debug</p>
              <p className="text-slate-500 text-xs mb-2">Token: {token ? token.slice(0, 12) + '…' : 'none'} | State: <span className="text-yellow-400">{state}</span></p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {debugLog.map((l, i) => <p key={i} className="text-slate-400 text-xs font-mono">{l}</p>)}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Restaurant Manager Pro · Secure Employee Onboarding
        </p>
      </div>
    </div>
  );
}