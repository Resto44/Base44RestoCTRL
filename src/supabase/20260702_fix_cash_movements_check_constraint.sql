-- ============================================================
-- FIX: cash_movements.movement_type CHECK constraint
-- Date: 2026-07-02
-- Description: Drops the old CHECK constraint that contained
--   stale values ('cash_purchases', 'cash_expenses') and
--   replaces it with the correct full set of movement types
--   matching the redesigned Cash Register.
-- ============================================================

-- Step 1: Drop the old (stale) CHECK constraint
ALTER TABLE public.cash_movements
  DROP CONSTRAINT IF EXISTS cash_movements_movement_type_check;

-- Step 2: Add the correct CHECK constraint with all valid movement types
ALTER TABLE public.cash_movements
  ADD CONSTRAINT cash_movements_movement_type_check
  CHECK (movement_type IN (
    'cash_sale',
    'customer_debt_collection',
    'supplier_refund',
    'owner_injection',
    'cash_transfer_in',
    'cash_deposit',
    'cash_purchase',
    'cash_expense',
    'supplier_payment',
    'customer_refund',
    'cash_transfer_out',
    'cash_withdrawal',
    'salary_advance',
    'shortage_adjustment',
    'overage_adjustment'
  ));
