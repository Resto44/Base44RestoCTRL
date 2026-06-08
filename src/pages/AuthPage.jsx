import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChefHat, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin();
    });
  }, []);

  const redirectAfterLogin = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const next = urlParams.get('next');
    window.location.href = next || '/';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      redirectAfterLogin();
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'customer' } },
    });
    if (error) {
      toast.error(error.message);
    } else if (data.user && !data.session) {
      toast.success('Check your email to confirm your account.');
      setMode('login');
    } else {
      redirectAfterLogin();
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=update-password`,
    });
    if (error) toast.error(error.message);
    else toast.success('Password reset email sent!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 pt-8 pb-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ChefHat className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-white font-black text-xl">Restaurant Manager</h1>
            <p className="text-blue-200 text-xs mt-1">mrghob.com</p>
          </div>

          <div className="p-6">
            {/* Mode tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
              >Sign In</button>
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
              >Sign Up</button>
            </div>

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1 relative">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-7 text-slate-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="submit" className="w-full h-11 font-bold rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  <button type="button" className="underline" onClick={() => setMode('reset')}>Forgot password?</button>
                </p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" type="text" placeholder="Ahmed Al-Rashid" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1 relative">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type={showPw ? 'text' : 'password'} placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-7 text-slate-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="submit" className="w-full h-11 font-bold rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </Button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-slate-600">Enter your email and we'll send a reset link.</p>
                <div className="space-y-1">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full h-11 font-bold rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  <button type="button" className="underline" onClick={() => setMode('login')}>Back to sign in</button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">Restaurant Manager Pro · www.mrghob.com</p>
      </div>
    </div>
  );
}