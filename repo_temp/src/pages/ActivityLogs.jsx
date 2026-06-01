import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, ChevronDown, ChevronUp, Trash2, Pencil, Plus, Download, Settings, Tag, GitBranch } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_CONFIG = {
  delete:         { color: 'bg-red-100 text-red-700',       icon: Trash2,     label: 'Delete' },
  update:         { color: 'bg-amber-100 text-amber-700',    icon: Pencil,     label: 'Update' },
  create:         { color: 'bg-emerald-100 text-emerald-700',icon: Plus,       label: 'Create' },
  price_change:   { color: 'bg-purple-100 text-purple-700',  icon: Tag,        label: 'Price Change' },
  branch_change:  { color: 'bg-blue-100 text-blue-700',      icon: GitBranch,  label: 'Branch Change' },
  settings_change:{ color: 'bg-slate-100 text-slate-700',    icon: Settings,   label: 'Settings' },
  export:         { color: 'bg-cyan-100 text-cyan-700',      icon: Download,   label: 'Export' },
};

function DiffViewer({ before, after }) {
  if (!before && !after) return null;
  let b, a;
  try { b = before ? JSON.parse(before) : null; } catch { b = before; }
  try { a = after ? JSON.parse(after) : null; } catch { a = after; }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
      {b && (
        <div className="bg-red-50 border border-red-200 rounded p-2">
          <p className="font-semibold text-red-600 mb-1">Before</p>
          <pre className="text-red-700 whitespace-pre-wrap overflow-auto max-h-32">{typeof b === 'object' ? JSON.stringify(b, null, 2) : String(b)}</pre>
        </div>
      )}
      {a && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
          <p className="font-semibold text-emerald-600 mb-1">After</p>
          <pre className="text-emerald-700 whitespace-pre-wrap overflow-auto max-h-32">{typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)}</pre>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
  const Icon = cfg.icon;
  const hasDiff = log.before || log.after;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-start gap-3 py-3 px-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium leading-tight">{log.description}</p>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                <Badge className={`text-xs py-0 ${cfg.color}`}>{cfg.label}</Badge>
                <span className="text-xs text-muted-foreground">{log.entity}</span>
                {log.branch && <span className="text-xs text-muted-foreground">· {log.branch}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium">{log.user_name || log.user_email}</p>
              <p className="text-xs text-muted-foreground">
                {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}
              </p>
            </div>
          </div>
          {hasDiff && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide diff' : 'Show diff'}
            </button>
          )}
          {expanded && <DiffViewer before={log.before} after={log.after} />}
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogs() {
  const { user } = useAuth();
  const { role } = useRole();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs', user?.email],
    queryFn: () => base44.entities.AuditLog.filter({ org_id: user.email }, '-created_date', 500),
    enabled: !!user?.email,
    staleTime: 30000,
  });

  if (role !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield className="w-12 h-12 text-muted-foreground opacity-40" />
        <p className="text-lg font-semibold">Owner Access Only</p>
        <p className="text-muted-foreground text-sm max-w-xs">Activity logs are restricted to organization owners for security.</p>
      </div>
    );
  }

  const filtered = logs.filter(l => {
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    const matchSearch = !search ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity?.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        action={
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            Owner only
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search actions, users, entities..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading logs...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">No activity logs yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Logs appear as users perform actions in the system.</p>
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-3">{filtered.length} records</div>
            {paginated.map(log => <LogRow key={log.id} log={log} />)}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}