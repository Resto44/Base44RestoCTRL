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

-- 4. Fix trigger function to handle DELETE correctly
-- The previous version failed on DELETE because it tried to access NEW.date (which is null)
CREATE OR REPLACE FUNCTION public.trg_auto_cash_movement_and_recalculate()
RETURNS TRIGGER AS $$
DECLARE
  v_settlement_id    UUID;
  v_movement_type    TEXT;
  v_direction        TEXT;
  v_amount           NUMERIC;
  v_source_module    TEXT;
  v_source_record_id TEXT;
  v_description      TEXT;
  v_created_by       TEXT;
  v_restaurant_id    UUID;
  v_branch           TEXT;
  v_date             DATE;
  v_old_amount       NUMERIC DEFAULT 0;
  v_row              RECORD;
BEGIN
  -- Use OLD for DELETE, NEW for INSERT/UPDATE
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  IF TG_TABLE_NAME = 'daily_sales' THEN
    v_date := v_row.date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := CASE WHEN v_row.restaurant_id ~ '^[0-9a-fA-F-]{36}$' THEN v_row.restaurant_id::UUID ELSE NULL END;
    v_source_module := 'Sales'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Cash Sale'; v_movement_type := 'cash_sale'; v_direction := 'in';
    v_amount := COALESCE(v_row.restaurant_cash, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.restaurant_cash, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_date := v_row.date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'Purchases'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Cash Purchase'; v_movement_type := 'cash_purchase'; v_direction := 'out';
    v_amount := COALESCE(v_row.qty * v_row.used_price, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.qty * OLD.used_price, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_date := v_row.date; v_branch := v_row.branch_key; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'Expenses'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Cash Expense'; v_movement_type := 'cash_expense'; v_direction := 'out';
    v_amount := COALESCE(v_row.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'customer_collections' THEN
    IF v_row.payment_method <> 'Cash' THEN RETURN v_row; END IF;
    v_date := v_row.date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'CustomerPayments'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Customer Debt Collection'; v_movement_type := 'customer_debt_collection'; v_direction := 'in';
    v_amount := COALESCE(v_row.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'supplier_payments' THEN
    IF v_row.payment_method <> 'Cash' THEN RETURN v_row; END IF;
    v_date := v_row.date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'SupplierPayments'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Supplier Payment'; v_movement_type := 'supplier_payment'; v_direction := 'out';
    v_amount := COALESCE(v_row.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'wallet_transactions' THEN
    IF v_row.payment_method <> 'Cash' THEN RETURN v_row; END IF;
    v_date := v_row.transaction_date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'Treasury'; v_source_record_id := v_row.id::TEXT;
    IF v_row.transaction_type = 'deposit' THEN
      v_description := 'Cash Deposit'; v_movement_type := 'cash_transfer_in'; v_direction := 'in';
    ELSIF v_row.transaction_type = 'withdrawal' THEN
      v_description := 'Cash Withdrawal'; v_movement_type := 'cash_transfer_out'; v_direction := 'out';
    ELSE RETURN v_row; END IF;
    v_amount := COALESCE(v_row.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSIF TG_TABLE_NAME = 'owner_cash_injections' THEN
    v_date := v_row.date; v_branch := v_row.branch; v_created_by := v_row.created_by;
    v_restaurant_id := v_row.restaurant_id;
    v_source_module := 'OwnerCashInjection'; v_source_record_id := v_row.id::TEXT;
    v_description := 'Owner Cash Injection'; v_movement_type := 'owner_injection'; v_direction := 'in';
    v_amount := COALESCE(v_row.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); ELSIF TG_OP = 'DELETE' THEN v_old_amount := v_amount; v_amount := 0; END IF;
  ELSE RETURN v_row; END IF;

  IF v_amount = 0 AND v_old_amount = 0 AND TG_OP <> 'DELETE' THEN RETURN v_row; END IF;

  v_settlement_id := public.get_or_create_settlement(v_date, v_branch, v_created_by, v_restaurant_id);

  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND v_old_amount > 0 THEN
    UPDATE public.cash_movements SET is_reversed = TRUE, updated_date = NOW()
    WHERE source_module = v_source_module AND source_record_id = OLD.id::TEXT AND is_reversed = FALSE;
    
    IF v_movement_type = 'cash_sale' THEN
      UPDATE public.daily_cash_settlements SET cash_sales = GREATEST(cash_sales - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_purchase' THEN
      UPDATE public.daily_cash_settlements SET cash_purchases = GREATEST(cash_purchases - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_expense' THEN
      UPDATE public.daily_cash_settlements SET cash_expenses = GREATEST(cash_expenses - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'supplier_payment' THEN
      UPDATE public.daily_cash_settlements SET supplier_payments = GREATEST(supplier_payments - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'customer_debt_collection' THEN
      UPDATE public.daily_cash_settlements SET customer_debt_collection = GREATEST(customer_debt_collection - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'owner_injection' THEN
      UPDATE public.daily_cash_settlements SET owner_injection = GREATEST(owner_injection - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_transfer_in' THEN
      UPDATE public.daily_cash_settlements SET cash_transfer_in = GREATEST(cash_transfer_in - v_old_amount, 0) WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_transfer_out' THEN
      UPDATE public.daily_cash_settlements SET cash_transfer_out = GREATEST(cash_transfer_out - v_old_amount, 0) WHERE id = v_settlement_id;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND v_amount > 0 THEN
    INSERT INTO public.cash_movements (
      date, branch, restaurant_id, created_by, direction, amount, movement_type,
      source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
    ) VALUES (
      v_date, v_branch, v_restaurant_id, v_created_by, v_direction, v_amount, v_movement_type,
      v_source_module, v_source_record_id, v_description, v_created_by, v_created_by, v_settlement_id
    );
    
    IF v_movement_type = 'cash_sale' THEN
      UPDATE public.daily_cash_settlements SET cash_sales = cash_sales + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_purchase' THEN
      UPDATE public.daily_cash_settlements SET cash_purchases = cash_purchases + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_expense' THEN
      UPDATE public.daily_cash_settlements SET cash_expenses = cash_expenses + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'supplier_payment' THEN
      UPDATE public.daily_cash_settlements SET supplier_payments = supplier_payments + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'customer_debt_collection' THEN
      UPDATE public.daily_cash_settlements SET customer_debt_collection = customer_debt_collection + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'owner_injection' THEN
      UPDATE public.daily_cash_settlements SET owner_injection = owner_injection + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_transfer_in' THEN
      UPDATE public.daily_cash_settlements SET cash_transfer_in = cash_transfer_in + v_amount WHERE id = v_settlement_id;
    ELSIF v_movement_type = 'cash_transfer_out' THEN
      UPDATE public.daily_cash_settlements SET cash_transfer_out = cash_transfer_out + v_amount WHERE id = v_settlement_id;
    END IF;
  END IF;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN v_row;
END;
$$ LANGUAGE plpgsql;
