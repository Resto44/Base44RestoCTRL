import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Building2, GitBranch, ChevronRight, Loader2 } from 'lucide-react';

/**
 * BranchSelector — shown after login when a manager/employee is assigned to multiple branches.
 * Stores the selected branch in sessionStorage so the app can use it for RLS filtering.
 */
export default function BranchSelector({ onSelect }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedBranches();
  }, [user?.id]);

  const loadAssignedBranches = async () => {
    if (!user?.id) return;
    try {
      // First check branch_assignments
      const { data: assignments } = await supabase
        .from('branch_assignments')
        .select('branch_id, branches(id, name, restaurant_id, restaurants(name))')
        .eq('user_id', user.id);

      if (assignments?.length > 0) {
        const branchList = assignments
          .map(a => a.branches)
          .filter(Boolean);
        setBranches(branchList);
        // Auto-select if only one branch
        if (branchList.length === 1) {
          handleSelect(branchList[0]);
          return;
        }
      } else {
        // Fall back to profile branch_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id, branches(id, name, restaurant_id, restaurants(name))')
          .eq('id', user.id)
          .single();

        if (profile?.branches) {
          setBranches([profile.branches]);
          handleSelect(profile.branches);
          return;
        }
      }
    } catch (err) {
      console.error('[BranchSelector]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (branch) => {
    sessionStorage.setItem('erp_active_branch_id', branch.id);
    sessionStorage.setItem('erp_active_branch_name', branch.name);
    sessionStorage.setItem('erp_active_restaurant_id', branch.restaurant_id || '');
    onSelect?.(branch);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading your branches…
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Branch Assigned</h2>
          <p className="text-slate-400 text-sm">
            You haven't been assigned to any branch yet. Please contact your Owner or Manager.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center mx-auto mb-4">
            <GitBranch className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Select Branch</h1>
          <p className="text-slate-400 text-sm">You have access to multiple branches. Choose one to continue.</p>
        </div>

        <div className="space-y-3">
          {branches.map(branch => (
            <button
              key={branch.id}
              onClick={() => handleSelect(branch)}
              className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-emerald-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{branch.name}</p>
                  {branch.restaurants?.name && (
                    <p className="text-slate-500 text-xs">{branch.restaurants.name}</p>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
