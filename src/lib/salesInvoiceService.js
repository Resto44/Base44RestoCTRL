/**
 * Sales Invoice Service
 *
 * - Auto-generates invoice numbers: INV-YYYYMMDD-0001
 * - Creates sales_invoice records on sale save
 * - Generates HTML-based PDF invoice
 * - Provides Download, Print, Share, and WhatsApp share
 * - Supports permanent PDF storage in Supabase
 */

import { supabase } from '@/api/supabaseClient';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Generate invoice number ───────────────────────────────────────────────────
export async function generateSalesInvoiceNumber(restaurantId, saleDate) {
  try {
    const dateObj = saleDate ? new Date(saleDate) : new Date();
    const { data, error } = await supabase.rpc('generate_sales_invoice_number', {
      p_restaurant_id: restaurantId,
      p_date: format(dateObj, 'yyyy-MM-dd'),
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[salesInvoiceService] RPC failed, using fallback:', err.message);
    const dateStr = format(saleDate ? new Date(saleDate) : new Date(), 'yyyyMMdd');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${dateStr}-${rand}`;
  }
}

// ── Create or upsert a sales invoice record ───────────────────────────────────
export async function createSalesInvoice({ invoiceNumber, saleId, saleData, restaurantId, createdBy }) {
  const networkSales = Number(saleData.restaurant_network || saleData.network || 0);
  const creditSales  = Number(saleData.credit || 0);
  const closingCash  = Number(saleData.closing_cash || 0);
  const salesTotal   = closingCash + networkSales + creditSales;

  const payload = {
    invoice_number:  invoiceNumber,
    sale_id:         saleId,
    restaurant_id:   restaurantId || null,
    branch:          saleData.branch,
    sale_date:       saleData.date,
    opening_cash:    Number(saleData.opening_cash || 0),
    closing_cash:    closingCash,
    cash_difference: Number(saleData.cash_difference || 0),
    cash_status:     saleData.cash_status || 'Balanced',
    network_sales:   networkSales,
    credit_sales:    creditSales,
    sales_total:     salesTotal,
    cashier_name:    saleData.cashier_name || '',
    shift:           saleData.shift || '',
    notes:           saleData.notes || '',
    cash_notes:      saleData.cash_notes || '',
    created_by:      createdBy || '',
  };

  const { data, error } = await supabase
    .from('sales_invoices')
    .upsert(payload, { onConflict: 'invoice_number' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Generate invoice HTML (for PDF / print) ───────────────────────────────────
export function buildInvoiceHTML(invoice, brandName = 'RestoCTRL', currency = '') {
  const fmt = (n) => `${currency}${Number(n || 0).toLocaleString()}`;
  const statusColor = {
    Balanced: '#065f46',
    Shortage: '#991b1b',
    Overage:  '#92400e',
  }[invoice.cash_status] || '#1e40af';
  const statusBg = {
    Balanced: '#d1fae5',
    Shortage: '#fee2e2',
    Overage:  '#fef3c7',
  }[invoice.cash_status] || '#dbeafe';

  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
  .brand { font-size: 28px; font-weight: bold; color: #2563eb; }
  .invoice-title { font-size: 16px; color: #6b7280; margin-top: 4px; }
  .invoice-number { font-size: 22px; font-weight: bold; color: #1e40af; margin-top: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .info-box { background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }
  .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 15px; font-weight: 600; margin-top: 4px; color: #1e293b; }
  .section { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin-bottom: 14px; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe; }
  .row:last-child { border-bottom: none; }
  .row.total { font-size: 18px; font-weight: bold; color: #1e40af; border-top: 2px solid #2563eb; padding-top: 12px; margin-top: 4px; }
  .row-label { color: #374151; font-size: 14px; }
  .row-value { font-weight: 600; font-size: 14px; }
  .status-badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; background: ${statusBg}; color: ${statusColor}; }
  .cash-section { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .cash-section .section-title { color: #065f46; }
  .cash-section .row { border-bottom-color: #bbf7d0; }
  .footer { text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div id="invoice-content">
    <div class="header">
      <div class="brand">${brandName}</div>
      <div class="invoice-title">SALES INVOICE</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Date</div>
        <div class="info-value">${invoice.sale_date || ''}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Branch</div>
        <div class="info-value">${invoice.branch || ''}</div>
      </div>
      ${invoice.cashier_name ? `
      <div class="info-box">
        <div class="info-label">Cashier</div>
        <div class="info-value">${invoice.cashier_name}</div>
      </div>` : ''}
      ${invoice.shift ? `
      <div class="info-box">
        <div class="info-label">Shift</div>
        <div class="info-value">${invoice.shift}</div>
      </div>` : ''}
    </div>

    <!-- Cash Register Section -->
    <div class="cash-section">
      <div class="section-title">Cash Register</div>
      <div class="row">
        <span class="row-label">Opening Cash</span>
        <span class="row-value">${fmt(invoice.opening_cash)}</span>
      </div>
      <div class="row">
        <span class="row-label">Closing Cash</span>
        <span class="row-value">${fmt(invoice.closing_cash)}</span>
      </div>
      <div class="row">
        <span class="row-label">Cash Difference</span>
        <span class="row-value" style="color:${Number(invoice.cash_difference) < 0 ? '#dc2626' : Number(invoice.cash_difference) > 0 ? '#d97706' : '#059669'}">
          ${Number(invoice.cash_difference) >= 0 ? '+' : ''}${fmt(invoice.cash_difference)}
        </span>
      </div>
      <div class="row">
        <span class="row-label">Cash Status</span>
        <span class="status-badge">${invoice.cash_status || 'Balanced'}</span>
      </div>
    </div>

    <!-- Sales Section -->
    <div class="section">
      <div class="section-title">Sales Breakdown</div>
      <div class="row">
        <span class="row-label">Cash Sales (Closing Cash)</span>
        <span class="row-value">${fmt(invoice.closing_cash)}</span>
      </div>
      <div class="row">
        <span class="row-label">Network Sales</span>
        <span class="row-value">${fmt(invoice.network_sales)}</span>
      </div>
      ${Number(invoice.credit_sales) > 0 ? `
      <div class="row">
        <span class="row-label">Credit Sales</span>
        <span class="row-value">${fmt(invoice.credit_sales)}</span>
      </div>` : ''}
      <div class="row total">
        <span>Sales Total</span>
        <span>${fmt(invoice.sales_total)}</span>
      </div>
    </div>

    ${invoice.notes ? `
    <div class="info-box" style="margin-bottom:20px;">
      <div class="info-label">Notes</div>
      <div class="info-value" style="font-size:13px;font-weight:400;">${invoice.notes}</div>
    </div>` : ''}

    ${invoice.cash_notes ? `
    <div class="info-box" style="margin-bottom:20px;">
      <div class="info-label">Cash Notes</div>
      <div class="info-value" style="font-size:13px;font-weight:400;">${invoice.cash_notes}</div>
    </div>` : ''}

    <div class="footer">
      <p>Generated by ${brandName} &bull; ${invoice.invoice_number}</p>
      <p style="margin-top:4px;">Thank you for your business</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Generate PDF and Upload to Supabase ───────────────────────────────────────
export async function generateAndUploadPDF(invoice, brandName, currency) {
  try {
    const html = buildInvoiceHTML(invoice, brandName, currency);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px';
    container.innerHTML = html;
    document.body.appendChild(container);

    const content = container.querySelector('#invoice-content');
    const canvas = await html2canvas(content, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    const pdfBlob = pdf.output('blob');
    document.body.removeChild(container);

    const fileName = `${invoice.invoice_number}.pdf`;
    const filePath = `invoices/${invoice.restaurant_id || 'default'}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('sales-invoices')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('sales-invoices')
      .getPublicUrl(filePath);

    // Update invoice record with pdf_url
    await supabase
      .from('sales_invoices')
      .update({ pdf_url: publicUrl })
      .eq('invoice_number', invoice.invoice_number);

    return publicUrl;
  } catch (err) {
    console.error('[salesInvoiceService] PDF generation/upload failed:', err);
    throw err;
  }
}

// ── Native Share ──────────────────────────────────────────────────────────────
export async function shareInvoiceNative(invoice, brandName, currency) {
  try {
    let pdfUrl = invoice.pdf_url;
    if (!pdfUrl) {
      pdfUrl = await generateAndUploadPDF(invoice, brandName, currency);
    }

    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const file = new File([blob], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Invoice ${invoice.invoice_number}`,
        text: `Sales Invoice from ${brandName}`,
        files: [file],
      });
    } else if (navigator.share) {
      await navigator.share({
        title: `Invoice ${invoice.invoice_number}`,
        text: `Sales Invoice from ${brandName}: ${pdfUrl}`,
        url: pdfUrl,
      });
    } else {
      // Fallback: copy to clipboard or open in new tab
      window.open(pdfUrl, '_blank');
    }
  } catch (err) {
    console.error('[salesInvoiceService] Native share failed:', err);
    // Fallback to WhatsApp if native share fails
    shareInvoiceWhatsApp(invoice, currency);
  }
}

// ── Open invoice in new tab (for print / view) ────────────────────────────────
export function openInvoicePrint(invoice, brandName, currency) {
  if (invoice.pdf_url) {
    window.open(invoice.pdf_url, '_blank');
    return;
  }
  const html = buildInvoiceHTML(invoice, brandName, currency);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to view the invoice.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

// ── Download invoice as PDF file ──────────────────────────────────────────────
export async function downloadInvoicePDF(invoice, brandName, currency) {
  try {
    let pdfUrl = invoice.pdf_url;
    if (!pdfUrl) {
      pdfUrl = await generateAndUploadPDF(invoice, brandName, currency);
    }
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${invoice.invoice_number}.pdf`;
    a.target = '_blank';
    a.click();
  } catch (err) {
    console.error('[salesInvoiceService] PDF download failed:', err);
    // Fallback to HTML download
    const html = buildInvoiceHTML(invoice, brandName, currency);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoice_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ── Print invoice ─────────────────────────────────────────────────────────────
export function printInvoice(invoice, brandName, currency) {
  if (invoice.pdf_url) {
    const win = window.open(invoice.pdf_url, '_blank');
    if (win) {
      win.focus();
      win.print();
    }
    return;
  }
  const html = buildInvoiceHTML(invoice, brandName, currency);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ── WhatsApp share ────────────────────────────────────────────────────────────
export function shareInvoiceWhatsApp(invoice, currency = '') {
  const fmt = (n) => `${currency}${Number(n || 0).toLocaleString()}`;
  const msg = [
    `*SALES INVOICE — ${invoice.invoice_number}*`,
    `Date: ${invoice.sale_date}`,
    `Branch: ${invoice.branch}`,
    invoice.cashier_name ? `Cashier: ${invoice.cashier_name}` : '',
    invoice.shift ? `Shift: ${invoice.shift}` : '',
    '',
    `*Cash Register*`,
    `Opening: ${fmt(invoice.opening_cash)}`,
    `Closing: ${fmt(invoice.closing_cash)}`,
    `Difference: ${Number(invoice.cash_difference) >= 0 ? '+' : ''}${fmt(invoice.cash_difference)}`,
    `Status: ${invoice.cash_status}`,
    '',
    `*Sales*`,
    `Cash Sales: ${fmt(invoice.closing_cash)}`,
    `Network: ${fmt(invoice.network_sales)}`,
    Number(invoice.credit_sales) > 0 ? `Credit: ${fmt(invoice.credit_sales)}` : '',
    `*Total: ${fmt(invoice.sales_total)}*`,
    invoice.notes ? `\nNotes: ${invoice.notes}` : '',
    invoice.pdf_url ? `\nView PDF: ${invoice.pdf_url}` : '',
  ].filter(l => l !== '').join('\n');

  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
