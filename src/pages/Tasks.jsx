import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-800', in_progress: 'bg-blue-100 text-blue-800', done: 'bg-green-100 text-green-800' };
const PRIORITY_COLORS = { low: 'bg-slate-100 text-slate-600', medium: 'bg-orange-100 text-orange-700', high: 'bg-red-100 text-red-700' };

function TaskForm({ initial, onSubmit, onCancel }) {
  const { t, branches } = useLanguage();
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    branch: initial?.branch || branches[0]?.key || '',
    assigned_to: initial?.assigned_to || '',
    due_date: initial?.due_date || format(new Date(), 'yyyy-MM-dd'),
    status: initial?.status || 'pending',
    priority: initial?.priority || 'medium',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div><Label>{t('title') || 'Title'}</Label><Input value={form.title} onChange={e => set('title', e.target.value)} /></div>
      <div><Label>{t('description')}</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div><Label>{t('branch')}</Label>
        <Select value={form.branch} onValueChange={v => set('branch', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>{t('assigned_to')}</Label><Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="email" /></div>
      <div><Label>{t('due_date')}</Label><Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>{t('status')}</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t('task_pending')}</SelectItem>
              <SelectItem value="in_progress">{t('task_in_progress')}</SelectItem>
              <SelectItem value="done">{t('task_done')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t('priority')}</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t('task_low')}</SelectItem>
              <SelectItem value="medium">{t('task_medium')}</SelectItem>
              <SelectItem value="high">{t('task_high')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => onSubmit(form)}>{t('save')}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { t, branches } = useLanguage();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date', 10000),
  });

  const createMut = useMutation({ mutationFn: d => base44.entities.Task.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowForm(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.Task.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setEditing(null); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.Task.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setDeleting(null); } });

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  return (
    <div>
      <PageHeader
        title={t('tasks')}
        action={
          <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); }}>
            <Plus className="w-4 h-4 mr-1" />{t('add_task')}
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter')} - All</SelectItem>
            <SelectItem value="pending">{t('task_pending')}</SelectItem>
            <SelectItem value="in_progress">{t('task_in_progress')}</SelectItem>
            <SelectItem value="done">{t('task_done')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-center text-muted-foreground text-sm py-8">{t('loading')}</p>
        : filtered.length === 0 ? <EmptyState />
        : (
          <div className="space-y-2">
            {filtered.map(task => (
              <Card key={task.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate">{task.title}</span>
                      <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || ''}`}>{t(`task_${task.priority}`)}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mb-1">{task.description}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${STATUS_COLORS[task.status] || ''}`}>{t(`task_${task.status}`)}</Badge>
                      {task.branch && <span className="text-xs text-muted-foreground">{branches.find(b => b.key === task.branch)?.label || task.branch}</span>}
                      {task.due_date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{task.due_date}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {task.status !== 'done' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => updateMut.mutate({ id: task.id, data: { ...task, status: 'done' } })}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(task)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(task)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('add_task')}</DialogTitle></DialogHeader>
          <TaskForm onSubmit={d => createMut.mutate(d)} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('edit_task')}</DialogTitle></DialogHeader>
          {editing && <TaskForm initial={editing} onSubmit={d => updateMut.mutate({ id: editing.id, data: d })} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle><AlertDialogDescription /></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting.id)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}