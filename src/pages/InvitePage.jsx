import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ROLES, ROLE_HOME } from '@/lib/RoleContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, CheckCircle2, AlertCircle, Loader2, GitBranch, RefreshCw } from 'lucide-react';

const LABELS = {
  en: {
    welcome: "You've Been Invited!",
    joining: 'Setting up your manager account…',
    success_title: "You're All Set!",
    success_msg: 'Your manager account is ready. Welcome aboard!',
    open_app: 'Open My Dashboard',
    invalid: 'This invite link is invalid.',
    expired: 'This invite link has expired. Please ask the owner to send a new one.',
    revoked: 'This invitation has been revoked.',
    login_required: 'To accept this invitation, sign in or create an account below.',
    login_btn: 'Sign In / Create Account',
    role: 'Branch Manager',
    restaurant: 'Restaurant',
    branch: 'Branch',
    error_generic: 'Something went wrong. Please try again.',
    retry: 'Retry',
  },
  ar: {
    welcome: 'تمت دعوتك!',
    joining: 'جاري إعداد حساب المدير…',
    success_title: 'أنت جاهز!',
    success_msg: 'حسابك كمدير جاهز. أهلاً بك!',
    open_app: 'فتح لوحتي',
    invalid: 'رابط الدعوة غير صالح.',
    expired: 'انتهت صلاحية رابط الدعوة. يرجى طلب رابط جديد من المالك.',
    revoked: 'تم إلغاء هذه الدعوة.',
    login_required: 'سجّل الدخول أو أنشئ حساباً لقبول الدعوة.',
    login_btn: 'تسجيل الدخول / إنشاء حساب',
    role: 'مدير الفرع',
    restaurant: 'المطعم',
    branch: 'الفرع',
    error_generic: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    retry: 'إعادة المحاولة',
  },
  fa: {
    welcome: 'دعوت شدید!',
    joining: 'در حال راه‌اندازی حساب مدیریت…',
    success_title: 'آماده‌اید!',
    success_msg: 'حساب مدیریت شما آماده است. خوش آمدید!',
    open_app: 'باز کردن داشبورد',
    invalid: 'این لینک دعوت نامعتبر است.',
    expired: 'این لینک دعوت منقضی شده است. از مالک بخواهید لینک جدید ارسال کند.',
    revoked: 'این دعوت لغو شده است.',
    login_required: 'برای پذیرش دعوت، وارد شوید یا حساب ایجاد کنید.',
    login_btn: 'ورود / ثبت‌نام',
    role: 'مدیر شعبه',
    restaurant: 'رستوران',
    branch: 'شعبه',
    error_generic: 'مشکلی پیش آمد. لطفاً دوباره امتحان کنید.',
    retry: 'تلاش مجدد',
  },
};

/**
 * Polls base44.auth.isAuthenticated() up to maxAttempts times,
 * waiting delayMs between each attempt. Returns true if authed, false otherwise.
 */
async function waitForAuth(maxAttempts = 8, delayMs = 600) {
  for (let i = 0; i < maxAttempts; i++) {
    const authed = await base44.auth.isAuthenticated();
    if (authed) return true;
    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

export default function InvitePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [status, setStatus] = useState('loading');
  const [inviteData, setInviteData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lang, setLang] = useState(localStorage.getItem('rc_lang') || 'en');
  const [debugLog, setDebugLog] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const hasRun = useRef(false);

  const L = LABELS[lang] || LABELS.en;
  const dir = lang === 'ar' || lang === 'fa' ? 'rtl' : 'ltr';

  const log = (msg) => {
    console.log('[InvitePage]', msg);
    setDebugLog(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`]);
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    startFlow();
  }, []);

  const startFlow = async () => {
    setStatus('loading');

    if (!token) {
      log('No token in URL');
      setErrorMsg(L.invalid);
      setStatus('error');
      return;
    }

    log(`Token: ${token.slice(0, 8)}…`);

    // Check if we're returning from a login redirect (stored in session OR local storage)
    const storedToken = sessionStorage.getItem('pending_invite_token') || localStorage.getItem('pending_invite_token');
    const returningFromLogin = storedToken === token;

    let authed = await base44.auth.isAuthenticated();
    log(`Auth check 1: ${authed}`);

    // If returning from login but auth not yet ready, poll a few times
    if (!authed && returningFromLogin) {
      log('Returning from login — polling for auth…');
      authed = await waitForAuth(12, 700);
      log(`Auth after polling: ${authed}`);
    }

    if (authed) {
      // Clear any pending token since we're now authed
      sessionStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_return_url');
      setStatus('processing');
      await callAcceptInvite();
    } else {
      // Not authed — call acceptInvite unauthenticated to get invite preview
      await fetchInvitePreview();
    }
  };

  const callAcceptInvite = async () => {
    log('Calling acceptInvite (authenticated)…');
    setStatus('processing');
    const res = await base44.functions.invoke('acceptInvite', { token });
    const data = res?.data;
    log(`Response: ${JSON.stringify(data)}`);

    if (!data) {
      setErrorMsg(L.error_generic);
      setStatus('error');
      return;
    }
    if (data.error) {
      handleBackendError(data);
      return;
    }
    if (data.pending_auth) {
      // Auth check failed server-side — show login prompt
      setInviteData(data);
      setStatus('login_required');
      return;
    }
    // success
    setInviteData(data);
    setStatus('success');
    log('Success — redirecting in 2.5s');
    const home = data.role ? (ROLE_HOME[data.role] || '/') : '/';
    setTimeout(() => window.location.replace(home), 2500);
  };

  const fetchInvitePreview = async () => {
    log('Fetching invite preview (unauthenticated)…');
    const res = await base44.functions.invoke('acceptInvite', { token });
    const data = res?.data;
    log(`Preview response: ${JSON.stringify(data)}`);

    if (!data) {
      setErrorMsg(L.error_generic);
      setStatus('error');
      return;
    }
    if (data.error) {
      handleBackendError(data);
      return;
    }
    if (data.pending_auth) {
      setInviteData(data);
      setStatus('login_required');
      return;
    }
    // Was actually authed server-side (edge case)
    setInviteData(data);
    setStatus('success');
    const home = data.role ? (ROLE_HOME[data.role] || '/') : '/';
    setTimeout(() => window.location.replace(home), 2500);
  };

  const handleBackendError = (data) => {
    const errMap = {
      invalid_token: L.invalid,
      expired: L.expired,
      revoked: L.revoked,
    };
    const msg = errMap[data.error] || data.message || L.error_generic;
    log(`Error: ${data.error} — ${msg}`);
    setErrorMsg(msg);
    setStatus('error');
  };

  const handleLogin = () => {
    log('Storing token and redirecting to login…');
    // Store in BOTH sessionStorage and localStorage — mobile/WhatsApp browsers may clear sessionStorage
    sessionStorage.setItem('pending_invite_token', token);
    localStorage.setItem('pending_invite_token', token);
    localStorage.setItem('pending_invite_return_url', window.location.pathname + window.location.search);
    base44.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Restaurant Manager Pro</p>
        </div>

        <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-sm">

          {(status === 'loading' || status === 'processing') && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">
                {status === 'processing' ? L.joining : 'Validating invitation…'}
              </p>
              {status === 'processing' && (
                <p className="text-slate-400 text-xs mt-2">Applying role & branch…</p>
              )}
            </div>
          )}

          {status === 'login_required' && (
            <div className="space-y-5">
              <div className="text-center">
                <GitBranch className="w-10 h-10 text-primary mx-auto mb-3" />
                <h2 className="text-white text-xl font-black">{L.welcome}</h2>
                <p className="text-slate-400 text-sm mt-1">{L.login_required}</p>
              </div>

              {inviteData && (
                <div className="bg-white/10 rounded-xl p-4 space-y-2 text-sm">
                  {inviteData.restaurant_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{L.restaurant}</span>
                      <span className="text-white font-medium">{inviteData.restaurant_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">{L.branch}</span>
                    <span className="text-white font-medium">{inviteData.branch_label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Role</span>
                    <span className="text-emerald-400 font-semibold">{L.role}</span>
                  </div>
                  {inviteData.email && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email</span>
                      <span className="text-white font-medium text-xs">{inviteData.email}</span>
                    </div>
                  )}
                </div>
              )}

              <Button className="w-full bg-primary text-white font-bold h-11" onClick={handleLogin}>
                {L.login_btn}
              </Button>
              <p className="text-center text-slate-500 text-xs">
                Use the same email address above to sign up — your role will be assigned automatically.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-5">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h2 className="text-white text-xl font-black">{L.success_title}</h2>
                <p className="text-slate-400 text-sm mt-1">{L.success_msg}</p>
              </div>

              {inviteData && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2 text-sm">
                  {inviteData.restaurant_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{L.restaurant}</span>
                      <span className="text-white font-medium">{inviteData.restaurant_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">{L.branch}</span>
                    <span className="text-white font-medium">{inviteData.branch_label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Role</span>
                    <span className="text-emerald-400 font-semibold">{L.role}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-400 text-xs justify-center">
                <Loader2 className="w-3 h-3 animate-spin" />
                Redirecting to dashboard…
              </div>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-11"
                onClick={() => window.location.replace('/')}>
                {L.open_app}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-white font-semibold">{errorMsg || L.error_generic}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => { hasRun.current = false; startFlow(); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> {L.retry}
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400"
                  onClick={() => window.location.replace('/')}>
                  Go to App
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-center gap-3 mt-4">
          {['en', 'ar', 'fa'].map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`text-xs ${lang === l ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'}`}>
              {l === 'en' ? 'English' : l === 'ar' ? 'العربية' : 'فارسی'}
            </button>
          ))}
        </div>

        {/* Debug panel */}
        <div className="mt-4 text-center">
          <button onClick={() => setShowDebug(v => !v)} className="text-slate-700 text-xs select-none">
            {showDebug ? '▲ Hide' : '· · ·'}
          </button>
          {showDebug && (
            <div className="mt-2 bg-black/40 rounded-lg p-3 text-left">
              <p className="text-slate-400 text-xs font-bold mb-1">Debug</p>
              <p className="text-slate-500 text-xs mb-2">Token: {token ? token.slice(0, 12) + '…' : 'none'} | Status: <span className="text-yellow-400">{status}</span></p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {debugLog.map((l, i) => (
                  <p key={i} className="text-slate-400 text-xs font-mono">{l}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}