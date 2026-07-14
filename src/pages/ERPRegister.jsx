import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { ROLES } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2, Users, UserCheck, User, ChefHat, Truck, Package,
  Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, ShieldCheck,
  GitBranch, Info
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_CONFIG = {
  [ROLES.OWNER]: {
    label: 'Owner', icon: Building2,
    color: 'from-violet-600 to-purple-700',
    border: 'border-violet-500/40', bg: 'bg-violet-500/10', textColor: 'text-violet-300',
    requiresBranch: false, requiresApproval: false,
    description: 'Create your organization and manage all branches',
  },
  [ROLES.GENERAL_MANAGER]: {
    label: 'General Manager', icon: Users,
    color: 'from-blue-600 to-cyan-700',
    border: 'border-blue-500/40', bg: 'bg-blue-500/10', textColor: 'text-blue-300',
    requiresBranch: false, requiresApproval: true,
    description: 'Cross-branch management — requires Owner approval',
  },
  [ROLES.MANAGER]: {
    label: 'Branch Manager', icon: UserCheck,
    color: 'from-emerald-600 to-teal-700',
    border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', textColor: 'text-emerald-300',
    requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Owner approval',
  },
  [ROLES.EMPLOYEE]: {
    label: 'Employee', icon: User,
    color: 'from-amber-600 to-orange-700',
    border: 'border-amber-500/40', bg: 'bg-amber-500/10', textColor: 'text-amber-300',
    requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.KITCHEN]: {
    label: 'Kitchen Staff', icon: ChefHat,
    color: 'from-red-600 to-rose-700',
    border: 'border-red-500/40', bg: 'bg-red-500/10', textColor: 'text-red-300',
    requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.DRIVER]: {
    label: 'Driver', icon: Truck,
    color: 'from-sky-600 to-blue-700',
    border: 'border-sky-500/40', bg: 'bg-sky-500/10', textColor: 'text-sky-300',
    requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.SUPPLIER]: {
    label: 'Supplier', icon: Package,
    color: 'from-slate-600 to-slate-700',
    border: 'border-slate-500/40', bg: 'bg-slate-500/10', textColor: 'text-slate-300',
    requiresBranch: false, requiresApproval: true,
    description: 'Register as a supplier — requires Owner authorization',
  },
};

export default function ERPRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRole = searchParams.get('role');

  const [selectedRole, setSelectedRole] = useState(preselectedRole || null);
  const [step, setStep] = useState(preselectedRole ? 'form' : 'role');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    branch_id: '',
    restaurant_id: '',
    // Supplier-specific
    company_name: '',
    product_categories: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const roleConf = ROLE_CONFIG[selectedRole] || null;

  // Load branches when role requires branch selection
  useEffect(() => {
    if (roleConf?.requiresBranch) {
      loadBranches();
    }
  }, [selectedRole]);

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, restaurant_id, restaurants(name)')
        .eq('is_active', true)
        .order('name');
      if (!error && data) {
        setBranches(data);
      }
    } catch (_) {}
    setLoadingBranches(false);
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password || form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (roleConf?.requiresBranch && !form.branch_id) errs.branch_id = 'Please select a branch';
    if (selectedRole === ROLES.SUPPLIER && !form.company_name.trim()) errs.company_name = 'Company name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: selectedRole,
          },
        },
      });

      if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;

      // 2. Determine restaurant_id from branch if applicable
      let restaurantId = form.restaurant_id;
      let branchId = form.branch_id || null;

      if (branchId) {
        const branch = branches.find(b => b.id === branchId);
        if (branch) restaurantId = branch.restaurant_id;
      }

      // 3. Create profile record
      const approvalStatus = roleConf?.requiresApproval ? 'pending' : 'approved';
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          role: selectedRole,
          branch_id: branchId,
          restaurant_id: restaurantId || null,
          approval_status: approvalStatus,
        });

      if (profileError) {
        console.error('[ERPRegister] Profile error:', profileError);
      }

      // 4. Create erp_registration record
      const metadata = selectedRole === ROLES.SUPPLIER
        ? { company_name: form.company_name, product_categories: form.product_categories, notes: form.notes }
        : {};

      await supabase.from('erp_registrations').insert({
        email: form.email,
        full_name: form.full_name,
        phone: form.phone || null,
        role: selectedRole,
        restaurant_id: restaurantId || null,
        branch_id: branchId,
        status: approvalStatus,
        user_id: userId,
        metadata,
      });

      // 5. Sign out immediately — user must wait for approval (except Owner)
      if (roleConf?.requiresApproval) {
        await supabase.auth.signOut();
      }

      setSuccess(true);
    } catch (err) {
      console.error('[ERPRegister]', err);
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Registration Submitted!</h2>
          {roleConf?.requiresApproval ? (
            <p className="text-slate-400 text-sm mb-6">
              Your registration as <span className="text-white font-semibold">{roleConf.label}</span> is pending approval.
              You will be notified once the Owner reviews your request.
            </p>
          ) : (
            <p className="text-slate-400 text-sm mb-6">
              Your account has been created. You can now sign in.
            </p>
          )}
          <Button
            onClick={() => navigate('/erp-login')}
            className="bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-8 h-11 rounded-xl"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            <span className="text-slate-300 text-sm font-medium">ERP Registration</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">
            {step === 'role' ? 'Choose Your Role' : `Register as ${roleConf?.label}`}
          </h1>
          <p className="text-slate-400 text-sm">
            {step === 'role' ? 'Select the role that matches your position' : roleConf?.description}
          </p>
        </div>

        {step === 'role' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(ROLE_CONFIG).map(([roleKey, rc]) => {
              const Icon = rc.icon;
              return (
                <button
                  key={roleKey}
                  onClick={() => { setSelectedRole(roleKey); setStep('form'); }}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border ${rc.border} ${rc.bg} hover:border-opacity-80 hover:scale-[1.02] transition-all duration-200 text-left`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${rc.color} flex items-center justify-center shrink-0 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm ${rc.textColor}`}>{rc.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-tight">{rc.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`bg-white/5 border ${roleConf?.border} rounded-2xl p-6`}>
            {/* Approval notice */}
            {roleConf?.requiresApproval && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs">
                  Your registration will be <strong>pending approval</strong>. You cannot log in until the Owner approves your account.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-sm">Full Name *</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Your full name"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500"
                  />
                  {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500"
                  />
                </div>
              </div>

              {selectedRole === ROLES.SUPPLIER && (
                <div>
                  <Label className="text-slate-300 text-sm">Company Name *</Label>
                  <Input
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Your company name"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500"
                  />
                  {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name}</p>}
                </div>
              )}

              <div>
                <Label className="text-slate-300 text-sm">Email Address *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label className="text-slate-300 text-sm">Password *</Label>
                <div className="relative mt-1.5">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {roleConf?.requiresBranch && (
                <div>
                  <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Select Branch *
                  </Label>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />Loading branches…
                    </div>
                  ) : (
                    <select
                      value={form.branch_id}
                      onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                      className="mt-1.5 w-full bg-slate-800 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="">— Select a branch —</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}{b.restaurants?.name ? ` (${b.restaurants.name})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.branch_id && <p className="text-red-400 text-xs mt-1">{errors.branch_id}</p>}
                </div>
              )}

              {selectedRole === ROLES.SUPPLIER && (
                <div>
                  <Label className="text-slate-300 text-sm">Product Categories</Label>
                  <Input
                    value={form.product_categories}
                    onChange={e => setForm(f => ({ ...f, product_categories: e.target.value }))}
                    placeholder="e.g. Fresh Produce, Dairy, Beverages"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r ${roleConf?.color} text-white font-bold h-11 rounded-xl mt-2`}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registering…</>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-slate-500 text-sm">
                Already have an account?{' '}
                <button onClick={() => navigate('/erp-login')} className="text-violet-400 hover:text-violet-300 font-medium">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {step === 'form' && (
          <button
            onClick={() => { setStep('role'); setSelectedRole(null); setErrors({}); }}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mt-4 mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to role selection
          </button>
        )}
      </div>
    </div>
  );
}
