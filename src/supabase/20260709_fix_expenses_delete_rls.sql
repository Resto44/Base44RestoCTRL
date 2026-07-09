-- Fix Expenses DELETE RLS Policy
-- Date: 2026-07-09
-- Description: Adds missing DELETE policies for the expenses table.
-- ============================================================

-- 1. Owner can delete expenses for their restaurant
DROP POLICY IF EXISTS "Expenses: owner delete all" ON public.expenses;
CREATE POLICY "Expenses: owner delete all" ON public.expenses
    FOR DELETE
    USING (
        restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE org_id = (auth.jwt() ->> 'email')
        )
    );

-- 2. Managers can delete expenses for their branch
DROP POLICY IF EXISTS "Expenses: manager delete branch" ON public.expenses;
CREATE POLICY "Expenses: manager delete branch" ON public.expenses
    FOR DELETE
    USING (
        branch_key = (
            SELECT branch FROM public.profiles
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- 3. Verify permissions are granted
GRANT DELETE ON public.expenses TO authenticated;
