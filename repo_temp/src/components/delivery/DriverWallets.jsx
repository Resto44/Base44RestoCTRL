import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, CheckCircle2, AlertTriangle, DollarSign, Plus, Banknote, CreditCard, Package } from 'lucide-react';

function DriverWalletCard({ driver, orders, openShift, onSettle, onIssueDebt, debts }) {
  const driverOrders = orders.filter(o => o.driver_id === driver.id);
  const totalCash = driverOrders.filter(o => o.payment_method === 'cash' && o.payment_collected).reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalNetwork = driverOrders.filter(o => o.payment_method === 'network' && o.payment_collected).reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalCredit = driverOrders.filter(o => o.payment_method === 'credit' && o.payment_collected).reduce((s, o) => s + (o.total_amount || 0), 0);
  const pendingOrders = driverOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const openDebts = debts.filter(d => d.driver_id === driver.id && d.status !== 'paid' && d.status !== 'written_off');
  const totalDebt = openDebts.reduce((s, d) => s + (d.remaining_amount || d.amount || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{driver.full_name}</CardTitle>
            <div className="text-xs text-muted-foreground">{driverOrders.length} orders today · {pendingOrders.length} active</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {openShift ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Shift Open</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">No Shift</Badge>
            )}
            {totalDebt > 0 && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Debt: {totalDebt} SAR</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Wallet breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <Banknote className="w-4 h-4 text-green-600 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-green-700">{totalCash.toFixed(0)}</div>
            <div className="text-[10px] text-green-600">Cash</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <CreditCard className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-blue-700">{totalNetwork.toFixed(0)}</div>
            <div className="text-[10px] text-blue-600">Network</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <Package className="w-4 h-4 text-orange-600 mx-auto mb-0.5" />
            <div className="text-sm font-bold text-orange-700">{totalCredit.toFixed(0)}</div>
            <div className="text-[10px] text-orange-600">Credit</div>
          </div>
        </div>

        {/* Net after debt */}
        {totalDebt > 0 && (
          <div className="bg-muted/50 rounded p-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Cash after debt deduction</span>
            <span className="font-bold text-primary">{Math.max(0, totalCash - totalDebt).toFixed(0)} SAR</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs h-8 gap-1" onClick={() => onSettle(driver, { totalCash, totalNetwork, totalCredit, totalDebt, openShift })}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Settle Shift
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => onIssueDebt(driver)}>
            <Plus className="w-3.5 h-3.5" /> Advance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettlementModal({ driver, walletData, branch, today, onClose, onDone }) {
  const [cashHandedOver, setCashHandedOver] = useState(String(Math.max(0, (walletData.totalCash || 0) - (walletData.totalDebt || 0))));
  const [networkVerified, setNetworkVerified] = useState(String(walletData.totalNetwork || 0));
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const cash = Number(cashHandedOver);
      const net = Number(networkVerified);
      const variance = cash - Math.max(0, (walletData.totalCash || 0) - (walletData.totalDebt || 0));

      // Create settlement record
      const settlement = await base44.entities.DriverSettlement.create({
        branch, driver_id: driver.id, driver_name: driver.full_name,
        shift_id: walletData.openShift?.id,
        date: today,
        cash_collected: walletData.totalCash,
        network_collected: walletData.totalNetwork,
        credit_collected: walletData.totalCredit,
        total_collected: walletData.totalCash + walletData.totalNetwork + walletData.totalCredit,
        debt_deducted: walletData.totalDebt,
        cash_handed_over: cash,
        network_verified: net,
        variance_cash: variance,
        status: Math.abs(variance) < 1 ? 'approved' : 'pending',
        manager_notes: notes,
      });

      // Close the shift
      if (walletData.openShift?.id) {
        await base44.entities.DriverShift.update(walletData.openShift.id, {
          status: 'settled',
          shift_end: new Date().toTimeString().slice(0, 5),
          settlement_id: settlement.id,
          cash_to_hand_over: cash,
        });
      }
    },
    onSuccess: () => {
      toast.success('Settlement recorded!');
      qc.invalidateQueries({ queryKey: ['driver-shifts-open'] });
      qc.invalidateQueries({ queryKey: ['driver-settlements'] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Settle Shift — {driver.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Cash collected</span><span className="font-semibold">{walletData.totalCash?.toFixed(2)} SAR</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Network collected</span><span className="font-semibold">{walletData.totalNetwork?.toFixed(2)} SAR</span></div>
            {walletData.totalDebt > 0 && <div className="flex justify-between text-red-600"><span>Debt deduction</span><span>−{walletData.totalDebt?.toFixed(2)} SAR</span></div>}
            <div className="flex justify-between font-bold border-t pt-1"><span>Expected cash handover</span><span className="text-primary">{Math.max(0, (walletData.totalCash || 0) - (walletData.totalDebt || 0)).toFixed(2)} SAR</span></div>
          </div>
          <div><Label className="text-xs">Actual Cash Received *</Label><Input type="number" value={cashHandedOver} onChange={e => setCashHandedOver(e.target.value)} /></div>
          <div><Label className="text-xs">Network Verified</Label><Input type="number" value={networkVerified} onChange={e => setNetworkVerified(e.target.value)} /></div>
          <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          {Math.abs(Number(cashHandedOver) - Math.max(0, (walletData.totalCash || 0) - (walletData.totalDebt || 0))) > 0.5 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Variance of {(Number(cashHandedOver) - Math.max(0, (walletData.totalCash || 0) - (walletData.totalDebt || 0))).toFixed(2)} SAR. Settlement will be marked as pending.
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DebtModal({ driver, branch, today, onClose }) {
  const [type, setType] = useState('salary_advance');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => base44.entities.DriverDebt.create({
      branch, driver_id: driver.id, driver_name: driver.full_name,
      type, amount: Number(amount), remaining_amount: Number(amount),
      paid_amount: 0, status: 'open', date: today, notes,
    }),
    onSuccess: () => { toast.success('Advance issued'); qc.invalidateQueries({ queryKey: ['driver-debts'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const TYPES = ['fuel_advance', 'salary_advance', 'shortage', 'penalty', 'equipment_damage', 'operational_loan', 'emergency_cash'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Issue Advance — {driver.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Amount (SAR)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={!amount || createMutation.isPending}>Issue</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DriverWallets({ drivers, orders, openShifts, branch, today }) {
  const [settlingDriver, setSettlingDriver] = useState(null);
  const [debtDriver, setDebtDriver] = useState(null);

  const { data: debts = [] } = useQuery({
    queryKey: ['driver-debts', branch],
    queryFn: () => base44.entities.DriverDebt.filter({ branch }),
    enabled: !!branch,
  });

  if (drivers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No drivers found for this branch.</p>
        <p className="text-xs mt-1">Add employees with position "driver" in the Employees page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map(driver => {
        const openShift = openShifts.find(s => s.driver_id === driver.id);
        return (
          <DriverWalletCard
            key={driver.id}
            driver={driver}
            orders={orders}
            openShift={openShift}
            debts={debts}
            onSettle={(d, walletData) => setSettlingDriver({ driver: d, walletData })}
            onIssueDebt={(d) => setDebtDriver(d)}
          />
        );
      })}

      {settlingDriver && (
        <SettlementModal
          driver={settlingDriver.driver}
          walletData={settlingDriver.walletData}
          branch={branch} today={today}
          onClose={() => setSettlingDriver(null)}
          onDone={() => setSettlingDriver(null)}
        />
      )}
      {debtDriver && (
        <DebtModal driver={debtDriver} branch={branch} today={today} onClose={() => setDebtDriver(null)} />
      )}
    </div>
  );
}