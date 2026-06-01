import React, { useState } from 'react';
import { useRole } from '@/lib/RoleContext';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Send, CheckCircle2, BarChart2, ShieldCheck, Wallet } from 'lucide-react';
import ManagerSubmitPanel from '@/components/settlement/ManagerSubmitPanel';
import ReviewPanel from '@/components/settlement/ReviewPanel';
import BranchBalanceTracker from '@/components/settlement/BranchBalanceTracker';
import SettlementAuditLog from '@/components/settlement/SettlementAuditLog';
import SponsorLedger from '@/components/settlement/SponsorLedger';

export default function SponsorTreasury() {
  const { role } = useRole();

  // Managers see only submit tab by default
  const defaultTab = role === 'manager' ? 'submit' : 'dashboard';
  const [tab, setTab] = useState(defaultTab);

  if (role === 'cashier') {
    return <div className="text-center py-20 text-muted-foreground text-sm">Access restricted.</div>;
  }

  return (
    <div>
      <PageHeader title="Sponsor ↔ Owner Settlement" />

      <div className="mb-4 p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
        <div className="text-xs text-violet-700">
          <p className="font-semibold mb-0.5">3-Party Settlement: Branch Manager → Sponsor (كفيل) → Owner</p>
          <p>Manager submits nightly network sales with proof → Sponsor reviews & approves → Owner receives settlement → Owner funds branches.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-5 mb-4">
          <TabsTrigger value="submit" className="text-xs flex items-center gap-1">
            <Send className="w-3 h-3" />Submit
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />Review
          </TabsTrigger>
          <TabsTrigger value="sponsor" className="text-xs flex items-center gap-1">
            <Wallet className="w-3 h-3" />Sponsor
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs flex items-center gap-1">
            <BarChart2 className="w-3 h-3" />Balances
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <ManagerSubmitPanel />
        </TabsContent>

        <TabsContent value="review">
          <ReviewPanel />
        </TabsContent>

        <TabsContent value="sponsor">
          <SponsorLedger />
        </TabsContent>

        <TabsContent value="dashboard">
          <BranchBalanceTracker />
        </TabsContent>

        <TabsContent value="audit">
          <SettlementAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}