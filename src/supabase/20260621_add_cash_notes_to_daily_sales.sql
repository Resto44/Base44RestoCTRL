-- Add cash_notes column to daily_sales for cash register notes
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS cash_notes TEXT;
