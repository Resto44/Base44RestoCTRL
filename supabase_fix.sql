-- ============================================================
-- Fix for "permission denied for table users" and RLS issues
-- ============================================================

-- 1. Fix the get_my_role function to be more efficient
CREATE OR REPLACE FUNCTION public.get_my_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Profiles: Allow users to insert their own profile (for upsert/repair)
-- This is needed because the app uses upsert in updateMe
DROP POLICY IF EXISTS "Profiles: view own" ON profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
DROP POLICY IF EXISTS "Profiles: admin view all" ON profiles;
DROP POLICY IF EXISTS "Profiles: self insert" ON profiles;

CREATE POLICY "Profiles: view own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: self insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: admin view all" ON profiles FOR SELECT USING (get_my_role() = 'admin');

-- 3. Restaurants: Fix "permission denied for table users"
-- Instead of querying auth.users, we use auth.jwt() which is available in the session
DROP POLICY IF EXISTS "Restaurants: owner manage" ON restaurants;
DROP POLICY IF EXISTS "Restaurants: staff view" ON restaurants;

CREATE POLICY "Restaurants: owner manage" ON restaurants 
FOR ALL USING (org_id = (auth.jwt() ->> 'email'));

CREATE POLICY "Restaurants: staff view" ON restaurants 
FOR SELECT USING (id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Branches: Add missing policies
DROP POLICY IF EXISTS "Branches: owner manage all" ON branches;
DROP POLICY IF EXISTS "Branches: staff view" ON branches;

CREATE POLICY "Branches: owner manage all" ON branches 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Branches: staff view" ON branches 
FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Categories: Add missing policies
DROP POLICY IF EXISTS "Categories: owner manage all" ON categories;
DROP POLICY IF EXISTS "Categories: staff view" ON categories;

CREATE POLICY "Categories: owner manage all" ON categories 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Categories: staff view" ON categories 
FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 6. Products: Fix owner manage policy
DROP POLICY IF EXISTS "Products: owner manage all" ON products;
DROP POLICY IF EXISTS "Products: staff view" ON products;

CREATE POLICY "Products: owner manage all" ON products 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Products: staff view" ON products 
FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 7. Inventory: Fix owner manage policy
DROP POLICY IF EXISTS "Inventory: owner manage all" ON inventory;
DROP POLICY IF EXISTS "Inventory: manager manage branch" ON inventory;
DROP POLICY IF EXISTS "Inventory: staff view branch" ON inventory;

CREATE POLICY "Inventory: owner manage all" ON inventory 
FOR ALL USING (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "Inventory: manager manage branch" ON inventory 
FOR ALL USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "Inventory: staff view branch" ON inventory 
FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

-- 8. Customers: Fix owner manage policy
DROP POLICY IF EXISTS "Customers: owner manage all" ON customers;
DROP POLICY IF EXISTS "Customers: staff view" ON customers;

CREATE POLICY "Customers: owner manage all" ON customers 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Customers: staff view" ON customers 
FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 9. Suppliers: Fix owner manage policy
DROP POLICY IF EXISTS "Suppliers: owner manage all" ON suppliers;
DROP POLICY IF EXISTS "Suppliers: staff view" ON suppliers;

CREATE POLICY "Suppliers: owner manage all" ON suppliers 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Suppliers: staff view" ON suppliers 
FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()));

-- 10. Orders: Fix owner manage policy
DROP POLICY IF EXISTS "Orders: owner manage all" ON orders;
DROP POLICY IF EXISTS "Orders: manager manage branch" ON orders;
DROP POLICY IF EXISTS "Orders: staff view branch" ON orders;
DROP POLICY IF EXISTS "Orders: waiter/cashier create" ON orders;

CREATE POLICY "Orders: owner manage all" ON orders 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Orders: manager manage branch" ON orders 
FOR ALL USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "Orders: staff view branch" ON orders 
FOR SELECT USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Orders: staff create" ON orders 
FOR INSERT WITH CHECK (get_my_role() IN ('waiter', 'cashier', 'admin', 'manager'));

-- 11. Expenses: Fix owner manage policy
DROP POLICY IF EXISTS "Expenses: owner manage all" ON expenses;
DROP POLICY IF EXISTS "Expenses: manager manage branch" ON expenses;
DROP POLICY IF EXISTS "Expenses: staff view branch" ON expenses;

CREATE POLICY "Expenses: owner manage all" ON expenses 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Expenses: manager manage branch" ON expenses 
FOR ALL USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "Expenses: staff view branch" ON expenses 
FOR SELECT USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

-- 12. Payments: Fix owner manage policy
DROP POLICY IF EXISTS "Payments: owner manage all" ON payments;
DROP POLICY IF EXISTS "Payments: staff view branch" ON payments;

CREATE POLICY "Payments: owner manage all" ON payments 
FOR ALL USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email'))));

CREATE POLICY "Payments: staff view branch" ON payments 
FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid())));

-- 13. Reservations: Fix owner manage policy
DROP POLICY IF EXISTS "Reservations: owner manage all" ON reservations;
DROP POLICY IF EXISTS "Reservations: manager manage branch" ON reservations;
DROP POLICY IF EXISTS "Reservations: staff view branch" ON reservations;

CREATE POLICY "Reservations: owner manage all" ON reservations 
FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "Reservations: manager manage branch" ON reservations 
FOR ALL USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "Reservations: staff view branch" ON reservations 
FOR SELECT USING (branch_key = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

-- 14. Daily Sales: Fix owner manage policy
DROP POLICY IF EXISTS "Daily Sales: owner manage all" ON daily_sales;
DROP POLICY IF EXISTS "Daily Sales: staff view branch" ON daily_sales;

CREATE POLICY "Daily Sales: owner manage all" ON daily_sales 
FOR ALL USING (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "Daily Sales: staff view branch" ON daily_sales 
FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

-- 15. Ensure the handle_new_user trigger is robust
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
