# SQL Changes Applied

## Summary

All RLS policies have been updated to use `auth.jwt() ->> 'email'` instead of direct `auth.users` table queries. An INSERT policy has been added to the `profiles` table, and the `handle_new_user()` trigger function has been improved.

## Changes by Table

### 1. `profiles` Table

**Added Policy:**
```sql
CREATE POLICY "Profiles: self insert" ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);
```

**Modified Policies:**
- `Profiles: view own` - Unchanged (SELECT by id)
- `Profiles: update own` - Unchanged (UPDATE by id)
- `Profiles: admin view all` - Unchanged (SELECT by role)

### 2. `restaurants` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Restaurants: owner manage" ON restaurants FOR ALL 
USING (org_id = (SELECT email FROM auth.users WHERE id = auth.uid()));
```

After:
```sql
CREATE POLICY "Restaurants: owner manage" ON restaurants FOR ALL 
USING (org_id = (auth.jwt() ->> 'email'));
```

### 3. `branches` Table

**Added Policies:**
```sql
CREATE POLICY "Branches: owner manage all" ON branches FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Branches: staff view" ON branches FOR SELECT 
USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));
```

### 4. `categories` Table

**Added Policies:**
```sql
CREATE POLICY "Categories: owner manage all" ON categories FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Categories: staff view" ON categories FOR SELECT 
USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));
```

### 5. `products` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Products: owner manage all" ON products FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Products: owner manage all" ON products FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

### 6. `inventory` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Inventory: owner manage all" ON inventory FOR ALL 
USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));
```

After:
```sql
CREATE POLICY "Inventory: owner manage all" ON inventory FOR ALL 
USING (created_by = (auth.jwt() ->> 'email'));
```

### 7. `customers` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Customers: owner manage all" ON customers FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Customers: owner manage all" ON customers FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

### 8. `suppliers` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Suppliers: owner manage all" ON suppliers FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Suppliers: owner manage all" ON suppliers FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

### 9. `orders` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Orders: owner manage all" ON orders FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Orders: owner manage all" ON orders FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

**Added Policy:**
```sql
CREATE POLICY "Orders: staff create" ON orders FOR INSERT 
WITH CHECK (get_my_role() IN ('waiter', 'cashier', 'admin', 'manager'));
```

### 10. `expenses` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Expenses: owner manage all" ON expenses FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Expenses: owner manage all" ON expenses FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

### 11. `payments` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Payments: owner manage all" ON payments FOR ALL 
USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid()))));
```

After:
```sql
CREATE POLICY "Payments: owner manage all" ON payments FOR ALL 
USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email'))));
```

### 12. `reservations` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Reservations: owner manage all" ON reservations FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (SELECT email FROM auth.users WHERE id = auth.uid())));
```

After:
```sql
CREATE POLICY "Reservations: owner manage all" ON reservations FOR ALL 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));
```

### 13. `daily_sales` Table

**Modified Policies:**

Before:
```sql
CREATE POLICY "Daily Sales: owner manage all" ON daily_sales FOR ALL 
USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));
```

After:
```sql
CREATE POLICY "Daily Sales: owner manage all" ON daily_sales FOR ALL 
USING (created_by = (auth.jwt() ->> 'email'));
```

## Helper Functions

### `get_my_role()` Function

**Improved with search_path:**
```sql
CREATE OR REPLACE FUNCTION public.get_my_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
```

### `handle_new_user()` Function

**Improved with ON CONFLICT handling:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Application Impact

These changes are **fully backward compatible** with the existing application code:

1. **`supabaseClient.js`** - No changes needed. The `auth.me()` and `auth.updateMe()` functions will now work correctly.
2. **`TenantContext.jsx`** - No changes needed. The `ownerFilter` already uses `user.email`.
3. **Entity CRUD Operations** - No changes needed. All create/update operations already inject `created_by: email`.
4. **RLS Evaluation** - Now uses JWT claims instead of system tables, improving security and performance.

## Testing Checklist

After applying these changes, verify:

- [ ] User signup and email verification work
- [ ] User login and profile load work
- [ ] Restaurant creation during onboarding works
- [ ] Dashboard loads without permission errors
- [ ] Category creation works
- [ ] Product creation works
- [ ] Customer creation works
- [ ] Order creation works
- [ ] Supplier creation works
- [ ] Inventory management works
- [ ] Expense tracking works
