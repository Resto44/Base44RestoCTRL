/**
 * Production — Restaurant Mode Exclusive Module
 *
 * Manages production orders for batch cooking and pre-production.
 * Links to Recipes (BOM) to calculate ingredient requirements.
 * Ingredient consumption is logged via the Inventory Service.
 *
 * Architecture: Restaurant Mode only. Guarded by ModeGuard.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';
import { useBusinessMode, ModeGuard } from '@/lib/BusinessModeContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Factory, Plus, ChefHat, Package, CheckCircle2, Clock, XCircle,
  AlertTriangle, Play, Check, X, Calendar, TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700',   icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     icon: Play },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700',       icon: XCircle },
};

function RestaurantModeRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Factory className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-base font-semibold text-foreground mb-1">Restaurant Mode Required</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Production Orders are only available in Restaurant Mode.
        Switch to a Restaurant business to access this module.
      </p>
    </div>
  );
}

export default function Production() {
  const { activeRestaurantId, managerBranch } = useTenant();
  const { isRestaurant } = useBusinessMode();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    recipe_id: '',
    quantity: 1,
    scheduled_date: '',
    notes: '',
  });

  const branchId = managerBranch || activeRestaurantId;

  // ── Fetch recipes ───────────────────────────────────────────────────────────
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', activeRestaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, menu_item, category, selling_price, ingredients')
        .eq('is_active', true)
        .order('menu_item');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeRestaurantId && isRestaurant,
  });

  // ── Fetch production orders ─────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production-orders', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          *,
          recipes(menu_item, category, ingredients)
        `)
        .eq('restaurant_id', activeRestaurantId)
        .order('created_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeRestaurantId && isRestaurant,
  });

  // ── Create production order ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate ingredient requirements
      const recipe = recipes.find(r => r.id === data.recipe_id);
      let ingredients = [];
      if (recipe?.ingredients) {
        try {
          const parsed = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients;
          ingredients = parsed.map(ing => ({
            ...ing,
            required_qty: (ing.qty || 0) * data.quantity,
          }));
        } catch {}
      }

      const { error } = await supabase.from('production_orders').insert({
        restaurant_id: activeRestaurantId,
        branch_id: branchId,
        recipe_id: data.recipe_id,
        quantity: data.quantity,
        scheduled_date: data.scheduled_date || null,
        notes: data.notes,
        status: 'pending',
        ingredients_consumed: JSON.stringify(ingredients),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      toast.success('Production order created');
      setShowForm(false);
      setForm({ recipe_id: '', quantity: 1, scheduled_date: '', notes: '' });
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  // ── Update order status ─────────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const update = { status };
      if (status === 'completed') update.completed_date = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('production_orders').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Order ${status === 'completed' ? 'completed' : 'updated'}`);
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }), [orders]);

  if (!isRestaurant) return <RestaurantModeRequired />;

  return (
    <div>
      <PageHeader
        title="Production"
        subtitle="Batch cooking & pre-production orders"
        action={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Order
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { key: 'pending', label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
          { key: 'in_progress', label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50' },
          { key: 'completed', label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <Card key={s.key} className={cn('border-0', s.bg)}>
            <CardContent className="p-3 text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{stats[s.key]}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Factory className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No production orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <Card key={order.id} className="border border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-orange-500" />
                        <p className="text-sm font-semibold">{order.recipes?.menu_item || 'Unknown Recipe'}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: <strong>{order.quantity}</strong>
                        {order.scheduled_date && ` · Scheduled: ${format(new Date(order.scheduled_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium', statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Ingredient requirements */}
                  {order.ingredients_consumed && (() => {
                    try {
                      const ings = JSON.parse(order.ingredients_consumed);
                      if (ings.length > 0) return (
                        <div className="bg-muted/40 rounded-lg p-2 mb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Ingredients Required</p>
                          <div className="flex flex-wrap gap-1">
                            {ings.slice(0, 4).map((ing, i) => (
                              <span key={i} className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                                {ing.product_name}: {ing.required_qty} {ing.unit}
                              </span>
                            ))}
                            {ings.length > 4 && <span className="text-[10px] text-muted-foreground">+{ings.length - 4} more</span>}
                          </div>
                        </div>
                      );
                    } catch {}
                    return null;
                  })()}

                  {/* Action buttons */}
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'in_progress' })}
                      >
                        <Play className="w-3 h-3 mr-1" /> Start
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs text-destructive"
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'cancelled' })}
                      >
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  )}
                  {order.status === 'in_progress' && (
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'completed' })}
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark Complete & Consume Ingredients
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── New Production Order Dialog ─────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipe *</Label>
              <Select value={form.recipe_id} onValueChange={v => setForm(f => ({ ...f, recipe_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select recipe..." />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.menu_item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity (servings)</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Scheduled Date (optional)</Label>
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Ingredient preview */}
            {form.recipe_id && (() => {
              const recipe = recipes.find(r => r.id === form.recipe_id);
              if (!recipe?.ingredients) return null;
              try {
                const ings = JSON.parse(recipe.ingredients);
                if (!ings.length) return null;
                return (
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-2">Ingredients Required</p>
                    {ings.map((ing, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span>{ing.product_name}</span>
                        <span className="font-medium">{(ing.qty * form.quantity).toFixed(2)} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.recipe_id}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Order'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
