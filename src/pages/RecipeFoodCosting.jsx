import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChefHat, Plus, Search, DollarSign, TrendingUp, Package,
  Calculator, BarChart3, Percent, Edit, Trash2, Star, X
} from 'lucide-react';
import { toast } from 'sonner';

// Real data loaded from Supabase — MOCK_RECIPES kept as fallback
const MOCK_RECIPES = [
  {
    id: '1', name: 'Classic Burger', category: 'Main', selling_price: 12.99, portions: 1,
    ingredients: [
      { name: 'Beef Patty', quantity: 0.2, unit: 'kg', cost: 3.50 },
      { name: 'Burger Bun', quantity: 1, unit: 'pcs', cost: 0.40 },
      { name: 'Lettuce', quantity: 0.05, unit: 'kg', cost: 0.15 },
      { name: 'Tomato', quantity: 0.08, unit: 'kg', cost: 0.20 },
      { name: 'Cheese Slice', quantity: 1, unit: 'pcs', cost: 0.35 },
    ]
  },
  {
    id: '2', name: 'Margherita Pizza', category: 'Pizza', selling_price: 15.99, portions: 2,
    ingredients: [
      { name: 'Pizza Dough', quantity: 0.3, unit: 'kg', cost: 0.60 },
      { name: 'Tomato Sauce', quantity: 0.1, unit: 'kg', cost: 0.30 },
      { name: 'Mozzarella', quantity: 0.2, unit: 'kg', cost: 1.80 },
      { name: 'Basil', quantity: 0.01, unit: 'kg', cost: 0.10 },
    ]
  },
  {
    id: '3', name: 'Caesar Salad', category: 'Salad', selling_price: 9.99, portions: 1,
    ingredients: [
      { name: 'Romaine Lettuce', quantity: 0.15, unit: 'kg', cost: 0.45 },
      { name: 'Caesar Dressing', quantity: 0.05, unit: 'kg', cost: 0.30 },
      { name: 'Croutons', quantity: 0.03, unit: 'kg', cost: 0.15 },
      { name: 'Parmesan', quantity: 0.02, unit: 'kg', cost: 0.40 },
    ]
  },
];

function RecipeCard({ recipe, onClick, currency }) {
  const totalCost = recipe.ingredients.reduce((s, i) => s + i.cost, 0);
  const costPerPortion = totalCost / (recipe.portions || 1);
  const margin = ((recipe.selling_price - costPerPortion) / recipe.selling_price) * 100;
  const costPct = (costPerPortion / recipe.selling_price) * 100;

  const marginColor = margin >= 65 ? 'text-emerald-600' : margin >= 50 ? 'text-amber-600' : 'text-red-500';
  const marginBg = margin >= 65 ? 'bg-emerald-50 border-emerald-200' : margin >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <Card className={`cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border ${marginBg}`} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold">{recipe.name}</p>
            <p className="text-xs text-muted-foreground">{recipe.category} · {recipe.portions} portion(s)</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{recipe.ingredients.length} ingredients</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs font-bold text-blue-600">{currency}{costPerPortion.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Cost/Portion</p>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{currency}{recipe.selling_price.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Selling Price</p>
          </div>
          <div>
            <p className={`text-xs font-bold ${marginColor}`}>{margin.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">Margin</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecipeDetailModal({ recipe, onClose, currency }) {
  if (!recipe) return null;
  const totalCost = recipe.ingredients.reduce((s, i) => s + (i.cost || 0), 0);
  const costPerPortion = totalCost / (recipe.portions || 1);
  const margin = recipe.selling_price > 0 ? ((recipe.selling_price - costPerPortion) / recipe.selling_price) * 100 : 0;
  const costPct = recipe.selling_price > 0 ? (costPerPortion / recipe.selling_price) * 100 : 0;

  return (
    <Dialog open={!!recipe} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            {recipe.name}
          </DialogTitle>
        </DialogHeader>

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Cost', value: `${currency}${totalCost.toFixed(2)}`, color: 'text-blue-600' },
            { label: 'Cost/Portion', value: `${currency}${costPerPortion.toFixed(2)}`, color: 'text-amber-600' },
            { label: 'Selling Price', value: `${currency}${(recipe.selling_price || 0).toFixed(2)}`, color: 'text-foreground' },
            { label: 'Gross Margin', value: `${margin.toFixed(1)}%`, color: margin >= 65 ? 'text-emerald-600' : margin >= 50 ? 'text-amber-600' : 'text-red-500' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-3">
                <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ingredients */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Ingredient</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Qty</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Cost</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{ing.name}</td>
                    <td className="py-2 text-right text-muted-foreground">{ing.quantity} {ing.unit}</td>
                    <td className="py-2 text-right font-semibold">{currency}{(ing.cost || 0).toFixed(2)}</td>
                    <td className="py-2 text-right text-muted-foreground">{totalCost > 0 ? ((ing.cost / totalCost) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pt-2">Total</td>
                  <td />
                  <td className="pt-2 text-right text-blue-600">{currency}{totalCost.toFixed(2)}</td>
                  <td className="pt-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Profitability indicator */}
        <div className={`p-3 rounded-xl text-center ${margin >= 65 ? 'bg-emerald-50 text-emerald-700' : margin >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          <p className="text-sm font-semibold">
            {margin >= 65 ? '✅ Excellent Margin' : margin >= 50 ? '⚠️ Acceptable Margin' : '❌ Low Margin — Review Pricing'}
          </p>
          <p className="text-xs mt-0.5">Food cost: {costPct.toFixed(1)}% of selling price</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecipeCreateModal({ open, onClose, products, currency, onSave }) {
  const [form, setForm] = useState({
    name: '',
    category: '',
    yield: 1,
    portions: 1,
    selling_price: 0,
    ingredients: []
  });

  const addIngredient = () => {
    setForm(f => ({
      ...f,
      ingredients: [...f.ingredients, { product_id: '', name: '', quantity: 1, unit: '', cost: 0 }]
    }));
  };

  const removeIngredient = (index) => {
    setForm(f => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index, field, value) => {
    setForm(f => {
      const newIngs = [...f.ingredients];
      newIngs[index] = { ...newIngs[index], [field]: value };
      
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value || p.product_id === value);
        if (prod) {
          newIngs[index].name = prod.name;
          newIngs[index].unit = prod.unit || '';
          newIngs[index].cost_per_unit = prod.cost_price || prod.default_cost || 0;
          newIngs[index].cost = (newIngs[index].quantity || 0) * (newIngs[index].cost_per_unit || 0);
        }
      }
      
      if (field === 'quantity' || field === 'cost_per_unit') {
        newIngs[index].cost = (newIngs[index].quantity || 0) * (newIngs[index].cost_per_unit || 0);
      }
      
      return { ...f, ingredients: newIngs };
    });
  };

  const totalCost = form.ingredients.reduce((sum, ing) => sum + (ing.cost || 0), 0);
  const costPerPortion = totalCost / (form.yield || 1);
  const foodCostPct = form.selling_price > 0 ? (costPerPortion / form.selling_price) * 100 : 0;
  const marginPct = 100 - foodCostPct;

  const handleSave = () => {
    if (!form.name) return toast.error('Recipe name is required');
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Recipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Recipe Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Classic Burger" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Main, Dessert" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Yield (Total Portions)</Label>
              <Input type="number" value={form.yield} onChange={e => setForm({ ...form, yield: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Portion Size</Label>
              <Input type="number" value={form.portions} onChange={e => setForm({ ...form, portions: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Selling Price</Label>
              <Input type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Ingredients</Label>
              <Button size="sm" variant="outline" onClick={addIngredient} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Ingredient
              </Button>
            </div>
            
            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-muted/30 p-2 rounded-lg border border-border">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-[10px]">Product</Label>
                    <select 
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                      value={ing.product_id}
                      onChange={e => updateIngredient(i, 'product_id', e.target.value)}
                    >
                      <option value="">Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" className="h-8 text-xs" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Unit</Label>
                    <Input className="h-8 text-xs" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px]">Cost</Label>
                    <div className="h-8 flex items-center px-2 bg-muted rounded text-xs font-medium">
                      {currency}{ing.cost.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => removeIngredient(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Cost/Portion</p>
                <p className="text-lg font-bold text-primary">{currency}{costPerPortion.toFixed(2)}</p>
              </div>
              <div className="text-center border-x border-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Food Cost %</p>
                <p className="text-lg font-bold text-amber-600">{foodCostPct.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Margin %</p>
                <p className={`text-lg font-bold ${marginPct >= 65 ? 'text-emerald-600' : 'text-amber-600'}`}>{marginPct.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={handleSave}>Save Recipe</Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RecipeFoodCosting() {
  const { t, currency } = useLanguage();
  const { ownerFilter } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState('recipes');
  const [search, setSearch] = useState('');  
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load real recipes from Supabase, fall back to mock data
  const { data: dbRecipes = [] } = useQuery({
    queryKey: ['recipes_db', ownerFilter],
    queryFn: () => base44.entities.Recipe.filter(ownerFilter || {}, 'name', 100),
    enabled: !!ownerFilter?.restaurant_id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', ownerFilter],
    queryFn: () => base44.entities.Product.filter(ownerFilter || {}, 'name', 500),
    enabled: !!ownerFilter?.restaurant_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      // 1. Create Recipe
      const recipeData = {
        name: form.name,
        category: form.category,
        yield: form.yield,
        portions: form.portions,
        restaurant_id: ownerFilter?.restaurant_id,
      };
      
      const newRecipe = await base44.entities.Recipe.create(recipeData);
      
      // 2. Create Recipe Ingredients
      if (form.ingredients.length > 0) {
        const ingredientsData = form.ingredients.map(ing => ({
          recipe_id: newRecipe.id,
          inventory_id: ing.product_id,
          quantity: ing.quantity,
          unit: ing.unit,
        }));
        await base44.entities.RecipeIngredient.bulkCreate(ingredientsData);
      }
      
      return newRecipe;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes_db'] });
      toast.success('Recipe saved successfully');
      setShowAddModal(false);
    },
    onError: (err) => {
      toast.error('Failed to save recipe: ' + err.message);
    }
  });

  // Merge: use real data if available, else mock
  const allRecipes = dbRecipes.length > 0 ? dbRecipes.map(r => ({
    ...r,
    ingredients: r.ingredients_json || [],
    portions: r.portions || 1,
    selling_price: r.selling_price || 0,
  })) : MOCK_RECIPES;

  const filtered = useMemo(() =>
    allRecipes.filter(r => search === '' || r.name.toLowerCase().includes(search.toLowerCase())),
    [allRecipes, search]
  );

  const avgMargin = allRecipes.length > 0 ? allRecipes.reduce((s, r) => {
    const cost = r.ingredients.reduce((a, i) => a + (i.cost || 0), 0) / (r.portions || 1);
    const sp = r.selling_price || 1;
    return s + ((sp - cost) / sp) * 100;
  }, 0) / allRecipes.length : 0;

  const avgFoodCost = 100 - avgMargin;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('recipe_food_costing')}</h1>
          <p className="text-xs text-muted-foreground">{allRecipes.length} recipes</p>
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddModal(true)}>
          <Plus className="w-3 h-3" /> Add Recipe
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{allRecipes.length}</p>
            <p className="text-[11px] text-blue-600/70">Recipes</p>
          </CardContent>
        </Card>
        <Card className={`${avgMargin >= 65 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${avgMargin >= 65 ? 'text-emerald-600' : 'text-amber-600'}`}>{avgMargin.toFixed(1)}%</p>
            <p className={`text-[11px] ${avgMargin >= 65 ? 'text-emerald-600/70' : 'text-amber-600/70'}`}>Avg Margin</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{avgFoodCost.toFixed(1)}%</p>
            <p className="text-[11px] text-amber-600/70">Food Cost %</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="recipes" className="text-xs">{t('recipes')}</TabsTrigger>
          <TabsTrigger value="costing" className="text-xs">{t('food_costing')}</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="recipes" className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="pl-9 h-9 text-sm" />
          </div>
          <div className="space-y-2">
            {filtered.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => setSelectedRecipe(r)} currency={currency} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="costing" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Food Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Recipe</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Cost</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Price</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecipes.map(r => {
                    const cost = r.ingredients.reduce((s, i) => s + (i.cost || 0), 0) / (r.portions || 1);
                    const margin = r.selling_price > 0 ? ((r.selling_price - cost) / r.selling_price) * 100 : 0;
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium">{r.name}</td>
                        <td className="py-2 text-right text-amber-600">{currency}{cost.toFixed(2)}</td>
                        <td className="py-2 text-right">{currency}{(r.selling_price || 0).toFixed(2)}</td>
                        <td className={`py-2 text-right font-bold ${margin >= 65 ? 'text-emerald-600' : margin >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {margin.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Profitability Matrix</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {allRecipes.map(r => {
                const cost = r.ingredients.reduce((s, i) => s + (i.cost || 0), 0) / (r.portions || 1);
                const margin = r.selling_price > 0 ? ((r.selling_price - cost) / r.selling_price) * 100 : 0;
                return (
                  <div key={r.id} className="flex items-center gap-3 py-1.5">
                    <span className="text-xs font-medium w-28 truncate">{r.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${margin >= 65 ? 'bg-emerald-500' : margin >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, margin)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-12 text-right ${margin >= 65 ? 'text-emerald-600' : margin >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} currency={currency} />
      <RecipeCreateModal 
        open={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        products={products} 
        currency={currency}
        onSave={(data) => saveMutation.mutate(data)}
      />
    </div>
  );
}
