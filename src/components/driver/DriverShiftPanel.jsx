import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Play, StopCircle, Clock, Banknote, CreditCard, Send, CheckCircle2 } from 'lucide-react';

export default function DriverShiftPanel({ driver, activeShift, todayOrders, branch, today, onShiftChange }) {
  const qc = useQueryClient();
  const [showSettle, setShowSettle] = useState(false);
  const [cashHandedOver, setCashHandedOver] = useState('');
  const [networkVerified, setNetworkVerified] = useState('');

  const completedOrders = todayOrders.filter(o => o.status === 'delivered');
  const totalCash = completedOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalNetwork = completedOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);

  const startShiftMutation = useMutation({
    mutationFn: () => base44.entities.DriverShift.create({
      branch,
      driver_id: driver?.id,
      driver_name: driver?.full_name,
      date: today,
      shift_start: new Date().toTimeString().slice(0, 5),
      status: 'open',
    }),
    onSuccess: () => {
      toast.success('Shift started!');
      qc.invalidateQueries({ queryKey: ['driver-shift'] });
      onShiftChange?.();
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: () => base44.entities.DriverShift.update(activeShift.id, {
      status: 'pending_settlement',
      shift_end: new Date().toTimeString().slice(0, 5),
      total_orders: completedOrders.length,
      total_cash_collected: totalCash,
      total_network_collected: totalNetwork,
      total_revenue: totalCash + totalNetwork,
    }),
    onSuccess: () => {
      toast.success('Shift closed. Pending manager settlement.');
      qc.invalidateQueries({ queryKey: ['driver-shift'] });
      setShowSettle(false);
      onShiftChange?.();
    },
  });

  const submitSettlementMutation = useMutation({
    mutationFn: async () => {
      const cashVal = parseFloat(cashHandedOver) || 0;
      const netVal = parseFloat(networkVerified) || totalNetwork;
      const variance = cashVal - totalCash;
      await base44.entities.DriverSettlement.create({
        branch,
        driver_id: driver?.id,
        driver_name: driver?.full_name,
        shift_id: activeShift?.id,
        date: today,
        cash_collected: totalCash,
        network_collected: totalNetwork,
        total_collected: totalCash + totalNetwork,
        cash_handed_over: cashVal,
        network_verified: netVal,
        variance_cash: variance,
        status: 'pending',
      });
      await base44.entities.DriverShift.update(activeShift.id, {
        status: 'pending_settlement',
        cash_to_hand_over: cashVal,
      });
    },
    onSuccess: () => {
      toast.success('Settlement submitted! Waiting for manager approval.');
      qc.invalidateQueries({ queryKey: ['driver-shift'] });
      qc.invalidateQueries({ queryKey: ['driver-settlements'] });
      setShowSettle(false);
      setCashHandedOver('');
      setNetworkVerified('');
      onShiftChange?.();
    },
  });

  const shiftDuration = activeShift?.shift_start
    ? (() => {
        const [h, m] = activeShift.shift_start.split(':').map(Number);
        const startMins = h * 60 + m;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const diff = nowMins - startMins;
        return diff > 0 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : '—';
      })()
    : '—';

  return (
    <div className="space-y-4">
      {/* Shift Status Card */}
      <Card className="overflow-hidden">
        <div className={`px-4 py-3 flex items-center justify-between ${activeShift ? 'bg-green-50' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${activeShift ? 'text-green-600' : 'text-muted-foreground'}`} />
            <span className="font-semibold text-sm">{activeShift ? 'Shift Active' : 'No Active Shift'}</span>
          </div>
          {activeShift && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{shiftDuration}</Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-4">
          {activeShift ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="font-bold">{activeShift.shift_start}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-green-600">Cash</p>
                  <p className="font-bold text-green-700">{totalCash.toFixed(0)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600">Network</p>
                  <p className="font-bold text-blue-700">{totalNetwork.toFixed(0)}</p>
                </div>
              </div>

              <div className="text-center bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Orders Completed</p>
                <p className="text-2xl font-black">{completedOrders.length}</p>
              </div>

              {!showSettle ? (
                <Button onClick={() => setShowSettle(true)} variant="outline"
                  className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50">
                  <StopCircle className="w-4 h-4 mr-2" /> End Shift & Settle
                </Button>
              ) : (
                <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-semibold">Submit Settlement</p>
                  <div>
                    <Label className="text-xs">Cash handed to manager (SAR)</Label>
                    <Input type="number" placeholder={`Expected: ${totalCash.toFixed(0)}`}
                      value={cashHandedOver} onChange={e => setCashHandedOver(e.target.value)}
                      className="h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs">Network payments (SAR)</Label>
                    <Input type="number" placeholder={`Expected: ${totalNetwork.toFixed(0)}`}
                      value={networkVerified} onChange={e => setNetworkVerified(e.target.value)}
                      className="h-12 text-base" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowSettle(false)}>Cancel</Button>
                    <Button className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={() => submitSettlementMutation.mutate()}
                      disabled={submitSettlementMutation.isPending}>
                      <Send className="w-4 h-4 mr-1" />
                      {submitSettlementMutation.isPending ? 'Submitting…' : 'Submit'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">Start your shift to begin receiving orders</p>
              <Button onClick={() => startShiftMutation.mutate()}
                disabled={startShiftMutation.isPending}
                className="w-full h-14 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700">
                <Play className="w-5 h-5 mr-2" />
                {startShiftMutation.isPending ? 'Starting…' : 'Start Shift'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending settlements */}
      {activeShift?.status === 'pending_settlement' && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Awaiting manager approval</p>
            <p className="text-xs text-amber-600">Your settlement has been submitted</p>
          </div>
        </div>
      )}
    </div>
  );
}