-- Fix Daily Sales table to support Cash Register fields and Restaurant scoping
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS opening_cash NUMERIC DEFAULT 0;
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS closing_cash NUMERIC DEFAULT 0;
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS cash_difference NUMERIC DEFAULT 0;
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS cash_status TEXT DEFAULT 'Balanced';

-- Update RLS policies to include restaurant_id check if needed, 
-- but existing created_by/branch policies are usually sufficient.
-- We add an index for performance on the Cash Register queries.
CREATE INDEX IF NOT EXISTS idx_daily_sales_restaurant_date ON public.daily_sales(restaurant_id, date);
