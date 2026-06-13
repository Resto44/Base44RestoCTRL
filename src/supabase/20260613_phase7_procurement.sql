-- Phase 7: Enterprise Procurement & Accounts Payable System Migration

-- 1. Extend supplier_invoices for multi-line items and full workflow
ALTER TABLE supplier_invoices 
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_costs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending', -- auto_approved, pending, approved, rejected
  ADD COLUMN IF NOT EXISTS debt_record_id UUID REFERENCES debt_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]'::jsonb;

-- 2. Extend supplier_payments for better linkage
ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE CASCADE;

-- 3. Extend inventory for valuation
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS average_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value NUMERIC DEFAULT 0;

-- 4. Extend debt_records to link to supplier invoices
ALTER TABLE debt_records
  ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE CASCADE;

-- 5. Extend purchases for backward compatibility (map to new invoice system)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE CASCADE;

-- 6. Procurement Analytics View
CREATE OR REPLACE VIEW procurement_analytics AS
SELECT 
  branch,
  COUNT(*) as total_invoices,
  SUM(total_amount) as total_purchases,
  SUM(total_amount - paid_amount) as outstanding_payables,
  SUM(CASE WHEN due_date < CURRENT_DATE AND status != 'paid' THEN (total_amount - paid_amount) ELSE 0 END) as overdue_payables
FROM supplier_invoices
GROUP BY branch;

-- 7. Add OCR Log Table
CREATE TABLE IF NOT EXISTS ocr_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL,
  file_url TEXT NOT NULL,
  extracted_data JSONB,
  status TEXT DEFAULT 'processed',
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ocr_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OCR Logs: owner manage all" ON ocr_logs FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "OCR Logs: staff view branch" ON ocr_logs FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- 8. Triggers for automatic inventory update on invoice approval
-- This logic will be handled primarily in application code to allow complex logic, 
-- but we can ensure timestamp updates.
CREATE OR REPLACE TRIGGER trg_ocr_logs BEFORE UPDATE ON ocr_logs FOR EACH ROW EXECUTE FUNCTION update_updated_date();
