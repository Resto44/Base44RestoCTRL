# Application Code Fixes

## Overview

After applying the SQL RLS fixes, the application code is largely compatible. However, there are a few areas where improvements can be made to ensure robust onboarding and dashboard functionality.

## 1. Inventory.jsx - Missing ownerFilter Merge

**File:** `src/pages/Inventory.jsx`

**Issue:** The inventory creation does not merge `ownerFilter` into the payload, which means the `created_by` field may not be set correctly.

**Current Code (Line 46):**
```javascript
const saveMutation = useMutation({
  mutationFn: async (data) => editing 
    ? base44.entities.Inventory.update(editing.id, data) 
    : base44.entities.Inventory.create(data),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeForm(); },
});
```

**Fixed Code:**
```javascript
const saveMutation = useMutation({
  mutationFn: async (data) => editing 
    ? base44.entities.Inventory.update(editing.id, data) 
    : base44.entities.Inventory.create({ ...data, ...ownerFilter }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeForm(); },
});
```

**Reason:** The RLS policy for inventory checks `created_by = (auth.jwt() ->> 'email')`. The `ownerFilter` contains `{ created_by: user?.email || '__none__' }`, which ensures the inventory record is correctly scoped to the current user.

---

## 2. Suppliers.jsx - Missing ownerFilter Merge

**File:** `src/pages/Suppliers.jsx`

**Issue:** The supplier creation does not merge `ownerFilter` into the payload.

**Current Code (Line 42):**
```javascript
const saveMutation = useMutation({
  mutationFn: (data) => editing 
    ? base44.entities.Supplier.update(editing.id, data) 
    : base44.entities.Supplier.create(data),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeForm(); },
});
```

**Fixed Code:**
```javascript
const saveMutation = useMutation({
  mutationFn: (data) => editing 
    ? base44.entities.Supplier.update(editing.id, data) 
    : base44.entities.Supplier.create({ ...data, ...ownerFilter }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeForm(); },
});
```

**Reason:** Suppliers are scoped by `restaurant_id`. The `ownerFilter` for owners contains `{ created_by: user?.email || '__none__' }`, which is used by the RLS policy to verify ownership.

---

## 3. Products.jsx - Missing restaurant_id

**File:** `src/pages/Products.jsx`

**Issue:** Products are not being created with a `restaurant_id`, which is required by the RLS policy.

**Current Code (Line 29):**
```javascript
const createMut = useMutation({
  mutationFn: (data) => base44.entities.Product.create(data),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); },
});
```

**Fixed Code:**
```javascript
const { activeRestaurant } = useTenant();

const createMut = useMutation({
  mutationFn: (data) => base44.entities.Product.create({ 
    ...data, 
    restaurant_id: activeRestaurant?.id,
  }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); },
});
```

**Reason:** The RLS policy for products checks `restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email'))`. Without a `restaurant_id`, the policy cannot verify ownership.

---

## 4. ProductForm.jsx - Add restaurant_id Support

**File:** `src/components/products/ProductForm.jsx`

**Issue:** The form does not collect or pass `restaurant_id`.

**Current Code:**
```javascript
const [form, setForm] = useState({
  product_id: '',
  name: '',
  category: '',
  unit: '',
  default_price: '',
  default_cost: '',
  ...initial,
});
```

**Fixed Code:**
```javascript
import { useTenant } from '@/lib/TenantContext';

export default function ProductForm({ initial, onSubmit, onCancel }) {
  const { t } = useLanguage();
  const { activeRestaurant } = useTenant();
  
  const [form, setForm] = useState({
    product_id: '',
    name: '',
    category: '',
    unit: '',
    default_price: '',
    default_cost: '',
    restaurant_id: activeRestaurant?.id,
    ...initial,
  });
  
  // ... rest of component
}
```

**Reason:** The form needs to include the `restaurant_id` so that products are correctly scoped to the active restaurant.

---

## 5. Inventory.jsx - Add restaurant_id Context

**File:** `src/pages/Inventory.jsx`

**Issue:** Inventory items should be scoped to the active restaurant for better multi-tenant isolation.

**Current Code (Line 40):**
```javascript
const { data: items = [] } = useQuery({ 
  queryKey: ['inventory', ownerFilter], 
  queryFn: () => base44.entities.Inventory.filter(ownerFilter, '-date', 5000), 
  enabled: !!ownerFilter?.created_by 
});
```

**Note:** This is acceptable as-is because the current schema uses `branch` and `created_by` for scoping. However, for future multi-tenant safety, consider adding `restaurant_id` to inventory records.

---

## 6. Onboarding.jsx - Ensure Profile Exists

**File:** `src/pages/Onboarding.jsx`

**Issue:** The onboarding flow should ensure the user's profile is fully populated before redirecting to the dashboard.

**Current Code (Line 127-131):**
```javascript
// Clear all cached queries then hard-redirect
qc.clear();

// Small delay to ensure cache is cleared before navigation
await new Promise(r => setTimeout(r, 200));
window.location.replace('/');
```

**Recommended Enhancement:**
```javascript
// Ensure profile is fully hydrated before redirecting
try {
  const profile = await base44.auth.me();
  if (!profile) {
    throw new Error('Profile not found after onboarding');
  }
} catch (e) {
  console.error('[Onboarding] Profile hydration failed:', e);
  setError('Failed to complete profile setup. Please refresh and try again.');
  toast.error('Profile setup failed — please refresh and try again.');
  setSaving(false);
  return;
}

// Clear all cached queries then hard-redirect
qc.clear();

// Small delay to ensure cache is cleared before navigation
await new Promise(r => setTimeout(r, 200));
window.location.replace('/');
```

**Reason:** This ensures that the profile is correctly created and accessible before the user is redirected to the dashboard.

---

## 7. AuthContext.jsx - Improved Error Handling

**File:** `src/lib/AuthContext.jsx`

**Current Code (Line 83-85):**
```javascript
if (e.status === 403) {
  setAuthError({ type: 'auth_required', message: 'Authentication required' });
}
```

**Recommended Enhancement:**
```javascript
if (e.status === 403 || e.message?.includes('permission denied')) {
  setAuthError({ type: 'auth_required', message: 'Authentication required' });
  console.warn('[AuthContext] Permission denied - likely RLS issue:', e.message);
}
```

**Reason:** This helps identify RLS-related permission errors during development and debugging.

---

## Summary of Changes

| File | Change Type | Priority | Impact |
|------|-------------|----------|--------|
| `Inventory.jsx` | Add ownerFilter merge | High | Inventory creation will fail without this |
| `Suppliers.jsx` | Add ownerFilter merge | High | Supplier creation will fail without this |
| `Products.jsx` | Add restaurant_id | High | Product creation will fail without this |
| `ProductForm.jsx` | Add restaurant_id support | High | Form must pass restaurant_id |
| `Onboarding.jsx` | Add profile verification | Medium | Improves reliability |
| `AuthContext.jsx` | Improve error handling | Low | Better debugging |

## Testing After Fixes

1. **Signup and Onboarding**
   - Create a new account
   - Complete onboarding (language, restaurant, branch, currency)
   - Verify redirect to dashboard

2. **Dashboard Access**
   - Verify dashboard loads without permission errors
   - Verify restaurant and branch data displays

3. **CRUD Operations**
   - Create a category
   - Create a product (should now work with restaurant_id)
   - Create a customer
   - Create an order
   - Create a supplier
   - Add inventory items

4. **Multi-Tenant Isolation**
   - Verify users cannot see other users' data
   - Verify managers can only see their assigned branch

---

## Notes

- All changes are **backward compatible** with existing data
- No database migrations are required beyond the SQL RLS fixes
- The application will continue to work with legacy tables like `delivery_orders` and `menu_products`
- Future refactoring should consolidate the legacy and new schemas
