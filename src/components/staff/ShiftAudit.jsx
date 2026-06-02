import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  ClipboardCheck, Camera,
  Flag, Plus, ChevronDown, ChevronUp, User
} from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

const STATUS_CONFIG = {
  matched:     { label: 'Matched',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  discrepancy: { label: 'Discrepancy', color: 'bg-red-100 text-red-700 border-red-200' },
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved:    { label: 'Resolved',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const RESOLUTION_TAGS = [
  'Counting Error', 'Cashier Mistake', 'System Error', 'Theft Suspected',
  'Voided Transaction', 'Refund Not Recorded', 'Change Error', 'Other',
];

export default function ShiftAudit() {
  const { currency } = useLanguage();
  const { branches } = useTenant();
  const qc = useQueryClient();
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [resolution, setResolution] = useState({ tag: '', notes: '', flagged_cashier: '', photo_url: '' });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.DailySales.list('-date', 500),
    staleTime: 60000,
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['staff_attendance'],
    queryFn: () => base44.entities.StaffAttendance.list('-date', 500),
  });
  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['shift_audits'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 200),
  });

  // Compute shift audit entries: pair sales records with attendance shifts for same date+branch
  const auditEntries = useMemo(() => {
    const dateMap = {};
    sales.forEach(s => {
      const key = `${s.date}_${s.branch}`;
      if (!dateMap[key]) dateMap[key] = { date: s.date, branch: s.branch, sales: [] };
      dateMap[key].sales.push(s);
    });

    return Object.values(dateMap).map(entry => {
      const totalCash = entry.sales.reduce((s, r) => s + (r.cash || 0), 0);
      const totalNetwork = entry.sales.reduce((s, r) => s + (r.network || 0), 0);
      const totalCredit = entry.sales.reduce((s, r) => s + (r.credit || 0), 0);
      const totalSales = totalCash + totalNetwork + totalCredit;

      // Find cashiers on shift that day
      const shifters = attendance.filter(a => a.date === entry.date && a.branch === entry.branch);

      // Find existing audit record
      const existingAudit = audits.find(a => {
        try {
          const m = JSON.parse(a.metadata || '{}');
          return m.audit_date === entry.date && m.audit_branch === entry.branch;
        } catch { return false; }
      });

      let status = 'pending';
      let expectedCash = 0, expectedNetwork = 0, cashierName = '', auditRecord = null;
      if (existingAudit) {
        try {
          const m = JSON.parse(existingAudit.metadata || '{}');
          expectedCash = m.expected_cash || 0;
          expectedNetwork = m.expected_network || 0;
          cashierName = m.flagged_cashier || '';
          auditRecord = { ...existingAudit, meta: m };
          const cashDiff = Math.abs(totalCash - expectedCash);
          const netDiff = Math.abs(totalNetwork - expectedNetwork);
          status = m.resolved ? 'resolved' : (cashDiff > 1 || netDiff > 1) ? 'discrepancy' : 'matched';
        } catch {}
      }

      return {
        key: `${entry.date}_${entry.branch}`,
        date: entry.date,
        branch: entry.branch,
        totalCash, totalNetwork, totalCredit, totalSales,
        shifters,
        expectedCash, expectedNetwork,
        cashDiff: totalCash - expectedCash,
        networkDiff: totalNetwork - expectedNetwork,
        status,
        auditRecord,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, attendance, audits]);

  const [auditForm, setAuditForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    branch: '',
    expected_cash: '',
    expected_network: '',
    cashier_name: '',
    notes: '',
  });
  const setAF = (k, v) => setAuditForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: data => base44.entities.AuditLog.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift_audits'] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AuditLog.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift_audits'] }); setResolvingId(null); },
  });

  const handleSaveAudit = () => {
    if (!auditForm.date || !auditForm.branch) return;
    saveMut.mutate({
      action: 'shift_audit',
      entity_type: 'DailySales',
      entity_id: `${auditForm.date}_${auditForm.branch}`,
      metadata: JSON.stringify({
        audit_date: auditForm.date,
        audit_branch: auditForm.branch,
        expected_cash: parseFloat(auditForm.expected_cash) || 0,
        expected_network: parseFloat(auditForm.expected_network) || 0,
        cashier_name: auditForm.cashier_name,
        notes: auditForm.notes,
        resolved: false,
      }),
    });
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setResolution(r => ({ ...r, photo_url: file_url }));
    setUploadingPhoto(false);
  };

  const handleResolve = (entry) => {
    if (!entry.auditRecord) return;
    const oldMeta = entry.auditRecord.meta || {};
    updateMut.mutate({
      id: entry.auditRecord.id,
      data: {
        metadata: JSON.stringify({
          ...oldMeta,
          resolution_tag: resolution.tag,
          resolution_notes: resolution.notes,
          flagged_cashier: resolution.flagged_cashier,
          photo_url: resolution.photo_url,
          resolved: true,
          resolved_at: new Date().toISOString(),
        }),
      },
    });
  };

  const filtered = useMemo(() =>
    auditEntries.filter(e =>
      (filterBranch === 'all' || e.branch === filterBranch) &&
      (!filterDate || e.date === filterDate)
    ),
    [auditEntries, filterBranch, filterDate]
  );

  const summary = useMemo(() => ({
    total: filtered.length,
    discrepancies: filtered.filter(e => e.status === 'discrepancy').length,
    pending: filtered.filter(e => e.status === 'pending').length,
    matched: filtered.filter(e => e.status === 'matched').length,
  }), [filtered]);

  const fmt = v => formatCurrency(v, currency);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: summary.total, color: 'text-foreground' },
          { label: 'Discrepancies', value: summary.discrepancies, color: 'text-red-500' },
          { label: 'Pending', value: summary.pending, color: 'text-amber-500' },
          { label: 'Matched', value: summary.matched, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label} className="p-2 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="flex gap-2 items-center">
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1 h-9 text-xs" />
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Set Expected
        </Button>
      </div>

      {/* Audit list */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No shift data found for this filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const cfg = STATUS_CONFIG[entry.status];
            const isExpanded = expanded[entry.key];
            return (
              <Card key={entry.key} className={`p-3 ${entry.status === 'discrepancy' ? 'border-red-300' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{entry.date}</p>
                      <Badge variant="outline" className="text-xs">{entry.branch}</Badge>
                      <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Recorded Cash</p>
                        <p className="font-semibold">{fmt(entry.totalCash)}</p>
                        {entry.auditRecord && (
                          <p className={`font-bold ${entry.cashDiff !== 0 ? (entry.cashDiff > 0 ? 'text-emerald-600' : 'text-red-500') : 'text-muted-foreground'}`}>
                            {entry.cashDiff > 0 ? '+' : ''}{fmt(entry.cashDiff)} vs expected
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Recorded Network</p>
                        <p className="font-semibold">{fmt(entry.totalNetwork)}</p>
                        {entry.auditRecord && (
                          <p className={`font-bold ${entry.networkDiff !== 0 ? (entry.networkDiff > 0 ? 'text-emerald-600' : 'text-red-500') : 'text-muted-foreground'}`}>
                            {entry.networkDiff > 0 ? '+' : ''}{fmt(entry.networkDiff)} vs expected
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Sales</p>
                        <p className="font-bold text-primary">{fmt(entry.totalSales)}</p>
                        {entry.shifters.length > 0 && (
                          <p className="text-muted-foreground">{entry.shifters.length} staff</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.status === 'discrepancy' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300"
                        onClick={() => { setResolvingId(entry.key); setResolution({ tag: '', notes: '', flagged_cashier: entry.shifters[0]?.staff_name || '', photo_url: '' }); }}>
                        <Flag className="w-3 h-3 mr-1" /> Resolve
                      </Button>
                    )}
                    <button onClick={() => setExpanded(e => ({ ...e, [entry.key]: !e[entry.key] }))}>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: staff on shift + resolution details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {entry.shifters.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Staff on shift:</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.shifters.map(s => (
                            <span key={s.id} className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded-full">
                              <User className="w-3 h-3" />{s.staff_name} ({s.check_in}–{s.check_out || '?'})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.auditRecord?.meta?.resolution_tag && (
                      <div className="p-2 bg-blue-50 rounded-lg text-xs">
                        <p className="font-semibold text-blue-700">Resolution: {entry.auditRecord.meta.resolution_tag}</p>
                        {entry.auditRecord.meta.flagged_cashier && <p className="text-blue-600">Flagged: {entry.auditRecord.meta.flagged_cashier}</p>}
                        {entry.auditRecord.meta.resolution_notes && <p className="text-muted-foreground mt-0.5">{entry.auditRecord.meta.resolution_notes}</p>}
                        {entry.auditRecord.meta.photo_url && (
                          <a href={entry.auditRecord.meta.photo_url} target="_blank" rel="noopener" className="text-blue-500 underline flex items-center gap-1 mt-1">
                            <Camera className="w-3 h-3" /> View receipt photo
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Set Expected Values Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Expected Shift Totals</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date *</Label><Input type="date" value={auditForm.date} onChange={e => setAF('date', e.target.value)} /></div>
              <div><Label className="text-xs">Branch *</Label><BranchSelect value={auditForm.branch} onChange={v => setAF('branch', v)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Expected Cash</Label><Input type="number" value={auditForm.expected_cash} onChange={e => setAF('expected_cash', e.target.value)} placeholder="0" /></div>
              <div><Label className="text-xs">Expected Network</Label><Input type="number" value={auditForm.expected_network} onChange={e => setAF('expected_network', e.target.value)} placeholder="0" /></div>
            </div>
            <div><Label className="text-xs">Cashier on Duty</Label><Input value={auditForm.cashier_name} onChange={e => setAF('cashier_name', e.target.value)} placeholder="Name" /></div>
            <div><Label className="text-xs">Notes</Label><Input value={auditForm.notes} onChange={e => setAF('notes', e.target.value)} /></div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveAudit} disabled={saveMut.isPending}>Save</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Discrepancy Dialog */}
      <Dialog open={!!resolvingId} onOpenChange={() => setResolvingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag className="w-4 h-4 text-red-500" /> Resolve Discrepancy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Resolution Tag *</Label>
              <Select value={resolution.tag} onValueChange={v => setResolution(r => ({ ...r, tag: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {RESOLUTION_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Flag Cashier for Review</Label>
              <Input value={resolution.flagged_cashier} onChange={e => setResolution(r => ({ ...r, flagged_cashier: e.target.value }))} placeholder="Cashier name" />
            </div>
            <div>
              <Label className="text-xs">Resolution Notes</Label>
              <Input value={resolution.notes} onChange={e => setResolution(r => ({ ...r, notes: e.target.value }))} placeholder="Explain what happened..." />
            </div>
            <div>
              <Label className="text-xs">Attach Receipt Photo</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-secondary rounded-md text-sm hover:bg-secondary/80">
                  <Camera className="w-4 h-4" />
                  {uploadingPhoto ? 'Uploading...' : resolution.photo_url ? 'Photo attached ✓' : 'Choose photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploadingPhoto} />
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => {
                const entry = filtered.find(e => e.key === resolvingId);
                if (entry) handleResolve(entry);
              }} disabled={updateMut.isPending || !resolution.tag}>
                Mark Resolved
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setResolvingId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}