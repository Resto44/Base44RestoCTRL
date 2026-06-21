-- ============================================================
-- Phase 3: Fixed Monthly Expenses flag
-- ============================================================

-- Add is_fixed flag to expense_categories
ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark standard fixed categories as fixed
-- (Rent, Salaries, Electricity, Water, Internet, Licenses, Government Fees)
UPDATE public.expense_categories
SET is_fixed = TRUE
WHERE LOWER(name) IN (
  'rent', 'salaries', 'salary', 'electricity', 'water', 'internet',
  'licenses', 'license', 'government fees', 'government fee',
  'إيجار', 'رواتب', 'راتب', 'كهرباء', 'ماء', 'إنترنت', 'تراخيص',
  'رسوم حكومية', 'اجاره', 'حقوق', 'برق', 'آب', 'اینترنت', 'مجوزها'
);

-- ============================================================
-- Phase 4: Auto Invoice Number for Sales
-- ============================================================

-- Create sales_invoices table
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT NOT NULL UNIQUE,
  sale_id          UUID REFERENCES public.daily_sales(id) ON DELETE CASCADE,
  restaurant_id    UUID,
  branch           TEXT,
  sale_date        DATE,
  opening_cash     NUMERIC DEFAULT 0,
  closing_cash     NUMERIC DEFAULT 0,
  cash_difference  NUMERIC DEFAULT 0,
  cash_status      TEXT,
  network_sales    NUMERIC DEFAULT 0,
  credit_sales     NUMERIC DEFAULT 0,
  sales_total      NUMERIC DEFAULT 0,
  cashier_name     TEXT,
  shift            TEXT,
  notes            TEXT,
  cash_notes       TEXT,
  created_by       TEXT,
  created_date     TIMESTAMPTZ DEFAULT NOW(),
  updated_date     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales Invoices: owner manage all" ON public.sales_invoices;
CREATE POLICY "Sales Invoices: owner manage all" ON public.sales_invoices
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Sales Invoices: staff view" ON public.sales_invoices;
CREATE POLICY "Sales Invoices: staff view" ON public.sales_invoices
  FOR SELECT USING (
    branch = (SELECT branch FROM public.profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_sales_invoices_sale_id       ON public.sales_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_number ON public.sales_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_sale_date      ON public.sales_invoices(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_branch         ON public.sales_invoices(branch);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_created_by     ON public.sales_invoices(created_by);

-- ============================================================
-- Phase 4: RPC to generate sequential sales invoice numbers
-- Format: INV-YYYYMMDD-0001
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_sales_invoice_number(
  p_restaurant_id UUID,
  p_date          DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_str TEXT;
  v_seq      INTEGER;
  v_padded   TEXT;
BEGIN
  v_date_str := TO_CHAR(p_date, 'YYYYMMDD');

  -- Upsert sequence row for this restaurant + date
  INSERT INTO public.invoice_sequences (restaurant_id, sequence_date, last_sequence)
  VALUES (p_restaurant_id, p_date, 1)
  ON CONFLICT (restaurant_id, sequence_date)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  v_padded := LPAD(v_seq::TEXT, 4, '0');
  RETURN 'INV-' || v_date_str || '-' || v_padded;
END;
$$;

-- Ensure unique constraint on invoice_sequences
ALTER TABLE public.invoice_sequences
  ADD CONSTRAINT IF NOT EXISTS uq_invoice_sequences_restaurant_date
  UNIQUE (restaurant_id, sequence_date);

-- Add invoice_number column to daily_sales for quick reference
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_daily_sales_invoice_number ON public.daily_sales(invoice_number);
