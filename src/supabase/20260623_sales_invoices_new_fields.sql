-- ============================================================
-- Migration: Add new fields to sales_invoices table
-- Date: 2026-06-23
-- ============================================================

-- Add cash_sales column (correct formula: closing_cash - opening_cash)
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS cash_sales NUMERIC DEFAULT 0;

-- Add sales_notes column
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS sales_notes TEXT;

-- Add manager_approval columns
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS manager_approval BOOLEAN DEFAULT FALSE;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;

-- Add POS and credit entries JSON columns
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS pos_entries_json TEXT;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS credit_entries_json TEXT;

-- Add pdf_url column for stored PDF
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Backfill cash_sales for existing records
UPDATE public.sales_invoices
SET cash_sales = GREATEST(0, closing_cash - opening_cash)
WHERE cash_sales IS NULL OR cash_sales = 0;

-- Add new columns to daily_sales for shift/cashier/approval
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS shift TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS cashier_name TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS sales_notes TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS manager_approval BOOLEAN DEFAULT FALSE;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS manager_approved_by TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS pos_entries_json TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS credit_entries_json TEXT;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Add credit_limit to debt_records
ALTER TABLE public.debt_records
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;

-- Index for faster invoice lookups
CREATE INDEX IF NOT EXISTS idx_sales_invoices_pdf_url ON public.sales_invoices(pdf_url) WHERE pdf_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_sales_shift ON public.daily_sales(shift);
CREATE INDEX IF NOT EXISTS idx_daily_sales_cashier ON public.daily_sales(cashier_name);
