-- Fix for sales_invoices_sale_id_fkey violation
-- Root cause: BEFORE trigger trying to insert into child table before parent record is committed.

-- 1. Drop existing problematic trigger
DROP TRIGGER IF EXISTS trg_auto_create_sales_invoice ON public.daily_sales;

-- 2. Create function for invoice number generation (BEFORE)
-- This ensures the parent record has an invoice number before it's saved.
CREATE OR REPLACE FUNCTION public.fn_daily_sales_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if not already present
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := public.generate_sales_invoice_number(
            CASE 
                WHEN NEW.restaurant_id IS NOT NULL AND NEW.restaurant_id != '' THEN NEW.restaurant_id::UUID 
                ELSE NULL 
            END, 
            NEW.date
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create BEFORE trigger for invoice number
CREATE TRIGGER trg_daily_sales_gen_inv_num
BEFORE INSERT OR UPDATE ON public.daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.fn_daily_sales_generate_invoice_number();

-- 4. Create function for syncing to sales_invoices (AFTER)
-- This ensures the parent daily_sales record exists before inserting into sales_invoices.
CREATE OR REPLACE FUNCTION public.fn_daily_sales_sync_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_cash_sales NUMERIC;
    v_network_sales NUMERIC;
    v_credit_sales NUMERIC;
    v_sales_total NUMERIC;
    v_rest_id UUID;
BEGIN
    -- Avoid recursion or processing auto-generated records if needed
    IF NEW.auto_generated = TRUE THEN
        RETURN NEW;
    END IF;

    -- Calculate totals
    v_cash_sales := COALESCE(NEW.restaurant_cash, NEW.cash, 0);
    v_network_sales := COALESCE(NEW.restaurant_network, NEW.network, 0);
    v_credit_sales := COALESCE(NEW.credit, 0);
    v_sales_total := v_cash_sales + v_network_sales + v_credit_sales;

    -- Safely parse restaurant_id
    BEGIN
        v_rest_id := CASE 
            WHEN NEW.restaurant_id IS NOT NULL AND NEW.restaurant_id != '' THEN NEW.restaurant_id::UUID 
            ELSE NULL 
        END;
    EXCEPTION WHEN others THEN
        v_rest_id := NULL;
    END;

    -- Insert or Update sales_invoices
    -- Since this is an AFTER trigger, NEW.id is now valid and exists in daily_sales.
    INSERT INTO public.sales_invoices (
        invoice_number, 
        sale_id, 
        restaurant_id, 
        branch_id,
        tenant_id,
        branch, 
        sale_date, 
        opening_cash, 
        closing_cash, 
        cash_difference, 
        cash_status, 
        cash_sales,
        network_sales, 
        credit_sales, 
        sales_total, 
        cashier_name, 
        shift, 
        notes, 
        cash_notes, 
        sales_notes, 
        manager_approval, 
        manager_approved_by, 
        pos_entries_json, 
        credit_entries_json, 
        created_by, 
        created_date, 
        updated_date
    ) VALUES (
        NEW.invoice_number, 
        NEW.id, 
        v_rest_id, 
        NEW.branch_id,
        NEW.tenant_id,
        NEW.branch, 
        NEW.date, 
        COALESCE(NEW.opening_cash, 0), 
        COALESCE(NEW.closing_cash, 0), 
        COALESCE(NEW.cash_difference, 0), 
        COALESCE(NEW.cash_status, 'Balanced'), 
        v_cash_sales,
        v_network_sales, 
        v_credit_sales, 
        v_sales_total, 
        COALESCE(NEW.cashier_name, ''), 
        COALESCE(NEW.shift, ''), 
        COALESCE(NEW.notes, ''), 
        COALESCE(NEW.cash_notes, ''), 
        COALESCE(NEW.sales_notes, ''), 
        COALESCE(NEW.manager_approval, FALSE), 
        COALESCE(NEW.manager_approved_by, ''), 
        CASE WHEN NEW.pos_entries_json IS NOT NULL THEN NEW.pos_entries_json::TEXT ELSE '' END, 
        CASE WHEN NEW.credit_entries_json IS NOT NULL THEN NEW.credit_entries_json::TEXT ELSE '' END, 
        COALESCE(NEW.created_by, ''), 
        NOW(), 
        NOW()
    )
    ON CONFLICT (invoice_number) 
    DO UPDATE SET 
        sale_id = EXCLUDED.sale_id,
        restaurant_id = EXCLUDED.restaurant_id,
        branch_id = EXCLUDED.branch_id,
        tenant_id = EXCLUDED.tenant_id,
        branch = EXCLUDED.branch,
        sale_date = EXCLUDED.sale_date,
        opening_cash = EXCLUDED.opening_cash,
        closing_cash = EXCLUDED.closing_cash,
        cash_difference = EXCLUDED.cash_difference,
        cash_status = EXCLUDED.cash_status,
        cash_sales = EXCLUDED.cash_sales,
        network_sales = EXCLUDED.network_sales,
        credit_sales = EXCLUDED.credit_sales,
        sales_total = EXCLUDED.sales_total,
        cashier_name = EXCLUDED.cashier_name,
        shift = EXCLUDED.shift,
        notes = EXCLUDED.notes,
        cash_notes = EXCLUDED.cash_notes,
        sales_notes = EXCLUDED.sales_notes,
        manager_approval = EXCLUDED.manager_approval,
        manager_approved_by = EXCLUDED.manager_approved_by,
        pos_entries_json = EXCLUDED.pos_entries_json,
        credit_entries_json = EXCLUDED.credit_entries_json,
        updated_date = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create AFTER trigger for sync
CREATE TRIGGER trg_daily_sales_sync_invoice
AFTER INSERT OR UPDATE ON public.daily_sales
FOR EACH ROW
EXECUTE FUNCTION public.fn_daily_sales_sync_invoice();
