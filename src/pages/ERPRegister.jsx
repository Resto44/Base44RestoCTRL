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
  GitBranch, Info, Search, Globe
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_CONFIG = {
  [ROLES.OWNER]: {
    label: 'Owner', icon: Building2,
    color: 'from-violet-600 to-purple-700',
    border: 'border-violet-500/40', bg: 'bg-violet-500/10', textColor: 'text-violet-300',
    requiresOrg: true, requiresBranch: false, requiresApproval: false,
    description: 'Create your organization and manage all branches',
  },
  [ROLES.GENERAL_MANAGER]: {
    label: 'General Manager', icon: Users,
    color: 'from-blue-600 to-cyan-700',
    border: 'border-blue-500/40', bg: 'bg-blue-500/10', textColor: 'text-blue-300',
    requiresOrg: false, requiresBranch: false, requiresApproval: true,
    description: 'Cross-branch management — requires Owner approval',
  },
  [ROLES.MANAGER]: {
    label: 'Branch Manager', icon: UserCheck,
    color: 'from-emerald-600 to-teal-700',
    border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', textColor: 'text-emerald-300',
    requiresOrg: false, requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Owner approval',
  },
  [ROLES.EMPLOYEE]: {
    label: 'Employee', icon: User,
    color: 'from-amber-600 to-orange-700',
    border: 'border-amber-500/40', bg: 'bg-amber-500/10', textColor: 'text-amber-300',
    requiresOrg: false, requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.KITCHEN]: {
    label: 'Kitchen Staff', icon: ChefHat,
    color: 'from-red-600 to-rose-700',
    border: 'border-red-500/40', bg: 'bg-red-500/10', textColor: 'text-red-300',
    requiresOrg: false, requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.DRIVER]: {
    label: 'Driver', icon: Truck,
    color: 'from-sky-600 to-blue-700',
    border: 'border-sky-500/40', bg: 'bg-sky-500/10', textColor: 'text-sky-300',
    requiresOrg: false, requiresBranch: true, requiresApproval: true,
    description: 'Select your branch — requires Manager approval',
  },
  [ROLES.SUPPLIER]: {
    label: 'Supplier', icon: Package,
    color: 'from-slate-600 to-slate-700',
    border: 'border-slate-500/40', bg: 'bg-slate-500/10', textColor: 'text-slate-300',
    requiresOrg: false, requiresBranch: false, requiresApproval: true,
    description: 'Register as a supplier — requires Owner authorization',
  },
};

const ALL_ROLES = [
  ROLES.OWNER, ROLES.GENERAL_MANAGER, ROLES.MANAGER,
  ROLES.EMPLOYEE, ROLES.KITCHEN, ROLES.DRIVER, ROLES.SUPPLIER,
];

const CURRENCIES = [
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial' },
  { code: 'JOD', symbol: 'د.أ', name: 'Jordanian Dinar' },
  { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar' },
  { code: 'TRY', symbol: '₺',   name: 'Turkish Lira' },
];

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe',       label: 'Café' },
  { value: 'retail',     label: 'Retail' },
  { value: 'pharmacy',   label: 'Pharmacy' },
  { value: 'wholesale',  label: 'Wholesale' },
  { value: 'other',      label: 'Other' },
];

export default function ERPRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRole = searchParams.get('role');

  const [selectedRole, setSelectedRole] = useState(preselectedRole || null);
  const [step, setStep] = useState(preselectedRole ? 'form' : 'role');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [orgSearch, setOrgSearch] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
    branch_id: '', organization_id: '',
    org_name: '', org_address: '', org_business_type: 'restaurant',
    org_branch_name: '', org_currency: 'SAR',
    company_name: '', product_categories: '', notes: '',
  });
  const [errors, setErrors] = useState({});

  const roleConf = ROLE_CONFIG[selectedRole] || null;

  useEffect(() => {
    if (selectedRole && selectedRole !== ROLES.OWNER) {
      searchOrgs('');
    }
  }, [selectedRole]);

  useEffect(() => {
    if (selectedOrg && roleConf?.requiresBranch) {
      loadBranches(selectedOrg.id);
    }
  }, [selectedOrg, selectedRole]);

  const searchOrgs = async (query) => {
    setLoadingOrgs(true);
    try {
      let q = supabase.from('restaurants').select('id, name, address').eq('is_active', true).limit(20);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      const { data, error } = await q.order('name');
      if (!error) setOrgs(data || []);
    } catch (_) {}
    setLoadingOrgs(false);
  };

  const loadBranches = async (orgId) => {
    setLoadingBranches(true);
    try {
      const { data, error } = await supabase
        .from('branches').select('id, name, location')
        .eq('restaurant_id', orgId).eq('is_active', true).order('name');
      if (!error) setBranches(data || []);
    } catch (_) {}
    setLoadingBranches(false);
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (selectedRole === ROLES.OWNER) {
      if (!form.org_name.trim()) e.org_name = 'Organization name is required';
      if (!form.org_branch_name.trim()) e.org_branch_name = 'First branch name is required';
    } else {
      if (!selectedOrg) e.organization_id = 'Please select an organization';
      if (roleConf?.requiresBranch && !form.branch_id) e.branch_id = 'Please select a branch';
      if (selectedRole === ROLES.SUPPLIER && !form.company_name.trim()) e.company_name = 'Company name is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: selectedRole } },
      });

      if (authError) { toast.error(authError.message); setLoading(false); return; }
      const userId = authData.user?.id;
      if (!userId) { toast.error('Registration failed.'); setLoading(false); return; }

      let organizationId = selectedOrg?.id || null;
      let branchId = form.branch_id || null;

      if (selectedRole === ROLES.OWNER) {
        const currency = CURRENCIES.find(c => c.code === form.org_currency) || CURRENCIES[0];
        const businessMode = ['retail','pharmacy','wholesale'].includes(form.org_business_type) ? 'retail' : 'restaurant';

        const { data: orgData, error: orgError } = await supabase
          .from('restaurants')
          .insert({
            name: form.org_name.trim(),
            address: form.org_address.trim() || null,
            currency: currency.symbol,
            business_type: form.org_business_type,
            business_mode: businessMode,
            created_by: form.email.trim(),
            org_id: form.email.trim(),
            is_active: true,
            is_initialized: false,
          })
          .select('id').single();

        if (orgError || !orgData) {
          toast.error('Failed to create organization. Please try again.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        organizationId = orgData.id;

        const { data: branchData } = await supabase
          .from('branches')
          .insert({
            restaurant_id: organizationId,
            name: form.org_branch_name.trim(),
            location: form.org_address.trim() || null,
            is_active: true,
            created_by: form.email.trim(),
          })
          .select('id').single();

        branchId = branchData?.id || null;

        try {
          await supabase.rpc('initialize_tenant', {
            p_organization_id: organizationId,
            p_branch_id: branchId,
            p_currency_code: currency.code,
            p_currency_symbol: currency.symbol,
            p_currency_name: currency.name,
          });
        } catch (initErr) {
          console.warn('[ERPRegister] Tenant init warning:', initErr.message);
        }
      }

      const approvalStatus = roleConf?.requiresApproval ? 'pending' : 'approved';

      await supabase.from('profiles').upsert({
        id: userId,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        role: selectedRole,
        branch_id: branchId,
        restaurant_id: organizationId,
        organization_id: organizationId,
        approval_status: approvalStatus,
        is_active: approvalStatus === 'approved',
        updated_date: new Date().toISOString(),
      });

      const metadata = selectedRole === ROLES.SUPPLIER
        ? { company_name: form.company_name.trim(), product_categories: form.product_categories, notes: form.notes }
        : {};

      await supabase.from('erp_registrations').insert({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        role: selectedRole,
        organization_id: organizationId,
        restaurant_id: organizationId,
        branch_id: branchId,
        status: approvalStatus,
        user_id: userId,
        metadata,
      });

      if (roleConf?.requiresApproval) await supabase.auth.signOut();
      setSuccess(true);
    } catch (err) {
      console.error('[ERPRegister]', err);
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const isOwner = selectedRole === ROLES.OWNER;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">
            {isOwner ? 'Organization Created!' : 'Registration Submitted!'}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            {isOwner
              ? 'Your organization has been created. You can now sign in to your Owner Dashboard.'
              : 'Your registration is pending approval. No dashboard access until the Owner approves your account.'}
          </p>
          {!isOwner && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-sm font-semibold">Status: Pending Approval</p>
                  <p className="text-amber-400/70 text-xs mt-1">You will be notified once the Owner reviews your request.</p>
                </div>
              </div>
            </div>
          )}
          <Button onClick={() => navigate('/erp-login')} className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold h-11 rounded-xl">
            {isOwner ? 'Sign In to Dashboard' : 'Back to Sign In'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">RestoCTRL ERP</h1>
          <p className="text-slate-500 text-sm mt-1">Enterprise Registration Portal</p>
        </div>

        {step === 'role' && (
          <div>
            <h2 className="text-white font-bold text-lg mb-4 text-center">Select Your Role</h2>
            <div className="grid grid-cols-1 gap-3">
              {ALL_ROLES.map((roleKey) => {
                const conf = ROLE_CONFIG[roleKey];
                const Icon = conf.icon;
                return (
                  <button key={roleKey} onClick={() => { setSelectedRole(roleKey); setStep('form'); }}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${conf.border} ${conf.bg} hover:bg-white/10 transition-all text-left`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${conf.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm ${conf.textColor}`}>{conf.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{conf.description}</p>
                    </div>
                    {conf.requiresApproval && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        Approval Required
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-slate-500 text-sm mt-6">
              Already have an account?{' '}
              <button onClick={() => navigate('/erp-login')} className="text-violet-400 hover:text-violet-300 font-medium">Sign in</button>
            </p>
          </div>
        )}

        {step === 'form' && roleConf && (
          <div>
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${roleConf.border} ${roleConf.bg} mb-5`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleConf.color} flex items-center justify-center shrink-0`}>
                {React.createElement(roleConf.icon, { className: 'w-4 h-4 text-white' })}
              </div>
              <div>
                <p className={`font-bold text-sm ${roleConf.textColor}`}>{roleConf.label}</p>
                <p className="text-slate-500 text-xs">{roleConf.description}</p>
              </div>
            </div>

            {roleConf.requiresApproval && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-5 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-400/80 text-xs leading-relaxed">
                  Your account will be <strong className="text-amber-300">Pending Approval</strong>. No dashboard access until the Owner approves your request.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-slate-300 text-sm">Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
              </div>

              {selectedRole === ROLES.SUPPLIER && (
                <div>
                  <Label className="text-slate-300 text-sm">Company Name *</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Your company name" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                  {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name}</p>}
                </div>
              )}

              <div>
                <Label className="text-slate-300 text-sm">Phone Number</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+966 5x xxx xxxx" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
              </div>

              <div>
                <Label className="text-slate-300 text-sm">Email Address *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label className="text-slate-300 text-sm">Password *</Label>
                <div className="relative mt-1.5">
                  <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters" className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {selectedRole === ROLES.OWNER && (
                <div className="space-y-4 border border-violet-500/20 rounded-xl p-4 bg-violet-500/5">
                  <p className="text-violet-300 text-sm font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Organization Setup
                  </p>
                  <div>
                    <Label className="text-slate-300 text-sm">Organization Name *</Label>
                    <Input value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                      placeholder="e.g. Al-Nakheel Restaurant Group" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                    {errors.org_name && <p className="text-red-400 text-xs mt-1">{errors.org_name}</p>}
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Business Type</Label>
                    <select value={form.org_business_type} onChange={e => setForm(f => ({ ...f, org_business_type: e.target.value }))}
                      className="mt-1.5 w-full bg-slate-800 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                      {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Address (optional)</Label>
                    <Input value={form.org_address} onChange={e => setForm(f => ({ ...f, org_address: e.target.value }))}
                      placeholder="City, Country" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" /> First Branch Name *
                    </Label>
                    <Input value={form.org_branch_name} onChange={e => setForm(f => ({ ...f, org_branch_name: e.target.value }))}
                      placeholder="e.g. Main Branch" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                    {errors.org_branch_name && <p className="text-red-400 text-xs mt-1">{errors.org_branch_name}</p>}
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> Default Currency
                    </Label>
                    <select value={form.org_currency} onChange={e => setForm(f => ({ ...f, org_currency: e.target.value }))}
                      className="mt-1.5 w-full bg-slate-800 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selectedRole !== ROLES.OWNER && (
                <div>
                  <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Select Organization *
                  </Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input value={orgSearch} onChange={e => { setOrgSearch(e.target.value); searchOrgs(e.target.value); }}
                      placeholder="Search organization name..." className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                  </div>
                  {errors.organization_id && <p className="text-red-400 text-xs mt-1">{errors.organization_id}</p>}
                  {loadingOrgs ? (
                    <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading organizations…
                    </div>
                  ) : orgs.length > 0 ? (
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {orgs.map(org => (
                        <button key={org.id} type="button"
                          onClick={() => { setSelectedOrg(org); setForm(f => ({ ...f, organization_id: org.id, branch_id: '' })); }}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${selectedOrg?.id === org.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{org.name}</p>
                            {org.address && <p className="text-slate-500 text-xs truncate">{org.address}</p>}
                          </div>
                          {selectedOrg?.id === org.id && <CheckCircle2 className="w-4 h-4 text-violet-400 ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs mt-2">No organizations found. Try a different search term.</p>
                  )}
                </div>
              )}

              {roleConf?.requiresBranch && selectedOrg && (
                <div>
                  <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" /> Select Branch *
                  </Label>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading branches…
                    </div>
                  ) : (
                    <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                      className="mt-1.5 w-full bg-slate-800 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                      <option value="">— Select a branch —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>)}
                    </select>
                  )}
                  {errors.branch_id && <p className="text-red-400 text-xs mt-1">{errors.branch_id}</p>}
                </div>
              )}

              {selectedRole === ROLES.SUPPLIER && (
                <>
                  <div>
                    <Label className="text-slate-300 text-sm">Product Categories</Label>
                    <Input value={form.product_categories} onChange={e => setForm(f => ({ ...f, product_categories: e.target.value }))}
                      placeholder="e.g. Fresh Produce, Dairy, Beverages" className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Additional Notes</Label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional information..." rows={3}
                      className="mt-1.5 w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 rounded-md px-3 py-2 text-sm resize-none focus:outline-none" />
                  </div>
                </>
              )}

              <Button type="submit" disabled={loading}
                className={`w-full bg-gradient-to-r ${roleConf?.color} text-white font-bold h-11 rounded-xl mt-2`}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {selectedRole === ROLES.OWNER ? 'Creating Organization…' : 'Submitting Registration…'}
                  </>
                ) : (
                  selectedRole === ROLES.OWNER ? 'Create Organization & Account' : 'Submit Registration Request'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-slate-500 text-sm">
                Already have an account?{' '}
                <button onClick={() => navigate('/erp-login')} className="text-violet-400 hover:text-violet-300 font-medium">Sign in</button>
              </p>
            </div>

            <button onClick={() => { setStep('role'); setSelectedRole(null); setErrors({}); setSelectedOrg(null); }}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mt-4 mx-auto transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to role selection
            </button>
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-6">© 2026 RestoCTRL ERP · All rights reserved</p>
      </div>
    </div>
  );
}
