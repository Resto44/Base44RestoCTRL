-- ============================================================
-- SECURITY FIX: Fix mutable search_path on all public functions
-- Migration 2
-- Date: 2026-06-23
-- Fixes: function_search_path_mutable warnings
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_date()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_date_col()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT COALESCE(auth.jwt() ->> 'email', ''); $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'admin'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta NUMERIC;
BEGIN
  IF NEW.transaction_type IN ('stock_in','purchase','transfer_in','opening') THEN v_delta := NEW.quantity;
  ELSIF NEW.transaction_type IN ('stock_out','recipe_consumption','transfer_out','waste') THEN v_delta := -NEW.quantity;
  ELSIF NEW.transaction_type = 'adjustment' THEN v_delta := NEW.quantity;
  ELSE v_delta := 0;
  END IF;
  UPDATE products SET current_stock = COALESCE(current_stock, 0) + v_delta, updated_date = NOW() WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_debt_invoice_number(p_restaurant_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_date TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD'); v_seq INTEGER; v_number TEXT;
BEGIN
  INSERT INTO invoice_sequences (restaurant_id, sequence_date, last_sequence)
  VALUES (p_restaurant_id, CURRENT_DATE, 1)
  ON CONFLICT (restaurant_id, sequence_date) DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;
  v_number := 'DBT-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_number;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_sales_invoice_number(p_restaurant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_date_str TEXT; v_seq INTEGER; v_padded TEXT;
BEGIN
  v_date_str := TO_CHAR(p_date, 'YYYYMMDD');
  INSERT INTO public.invoice_sequences (restaurant_id, sequence_date, last_sequence)
  VALUES (p_restaurant_id, p_date, 1)
  ON CONFLICT (restaurant_id, sequence_date) DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;
  v_padded := LPAD(v_seq::TEXT, 4, '0');
  RETURN 'INV-' || v_date_str || '-' || v_padded;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number(p_restaurant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_date_str TEXT; v_seq INTEGER; v_padded TEXT;
BEGIN
  v_date_str := TO_CHAR(p_date, 'YYYYMMDD');
  INSERT INTO public.invoice_sequences (restaurant_id, sequence_date, last_sequence)
  VALUES (p_restaurant_id, p_date, 1)
  ON CONFLICT (restaurant_id, sequence_date) DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;
  v_padded := LPAD(v_seq::TEXT, 4, '0');
  RETURN 'PUR-' || v_date_str || '-' || v_padded;
END; $$;
