import jsPDF from 'jspdf';

// ─── CSV ──────────────────────────────────────────────────────────────────────

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(filename, headers, rows) {
  const lines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ];
  const bom = '\uFEFF'; // UTF-8 BOM for Excel RTL compatibility
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function downloadPDF({ filename, title, subtitle, headers, rows, currency = '$', totalsRow }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginL = 14;
  const marginR = 14;
  const tableW = pageW - marginL - marginR;
  const colW = tableW / headers.length;
  const rowH = 8;
  let y = 14;

  // Title
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, marginL, y);
  y += 7;

  // Subtitle
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, marginL, y);
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  // Header row
  doc.setFillColor(37, 99, 235);
  doc.rect(marginL, y, tableW, rowH, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, i) => {
    doc.text(String(h), marginL + i * colW + 2, y + 5.5, { maxWidth: colW - 3 });
  });
  doc.setTextColor(0, 0, 0);
  y += rowH;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  rows.forEach((row, ri) => {
    if (y > 270) { doc.addPage(); y = 14; }
    if (ri % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginL, y, tableW, rowH, 'F');
    }
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), marginL + i * colW + 2, y + 5.5, { maxWidth: colW - 3 });
    });
    y += rowH;
  });

  // Totals row
  if (totalsRow) {
    doc.setFillColor(229, 231, 235);
    doc.rect(marginL, y, tableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    totalsRow.forEach((cell, i) => {
      doc.text(String(cell ?? ''), marginL + i * colW + 2, y + 5.5, { maxWidth: colW - 3 });
    });
  }

  doc.save(filename);
}

// ─── Trigger download ─────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sales export builders ────────────────────────────────────────────────────

export function buildSalesCSV(data, t, currency, branches) {
  const getBranchLabel = (key) => branches.find(b => b.key === key)?.label || key;
  const headers = [t('date'), t('branch'), t('cash'), t('network'), t('credit'), t('total_sales')];
  const rows = data.map(s => {
    const sCash = Number(s.restaurant_cash ?? s.cash ?? 0);
    const sNet  = Number(s.restaurant_network ?? s.network ?? 0);
    const total = sCash + sNet + (Number(s.credit) || 0);
    return [s.date, getBranchLabel(s.branch), sCash, sNet, Number(s.credit) || 0, total];
  });
  // Totals row
  const totals = rows.reduce((acc, r) => [
    '', '',
    acc[2] + Number(r[2]),
    acc[3] + Number(r[3]),
    acc[4] + Number(r[4]),
    acc[5] + Number(r[5]),
  ], ['', '', 0, 0, 0, 0]);
  rows.push(['', t('total_sales'), totals[2], totals[3], totals[4], totals[5]]);
  return { headers, rows };
}

export function buildSalesPDF(data, t, currency, branches, subtitle) {
  const getBranchLabel = (key) => branches.find(b => b.key === key)?.label || key;
  const headers = [t('date'), t('branch'), t('cash'), t('network'), t('credit'), t('total_sales')];
  const rows = data.map(s => {
    const sCash = Number(s.restaurant_cash ?? s.cash ?? 0);
    const sNet  = Number(s.restaurant_network ?? s.network ?? 0);
    const total = sCash + sNet + (Number(s.credit) || 0);
    return [s.date, getBranchLabel(s.branch), `${currency}${sCash.toLocaleString()}`, `${currency}${sNet.toLocaleString()}`, `${currency}${(Number(s.credit) || 0).toLocaleString()}`, `${currency}${total.toLocaleString()}`];
  });
  const totalCash   = data.reduce((s, r) => s + Number(r.restaurant_cash   ?? r.cash    ?? 0), 0);
  const totalNet    = data.reduce((s, r) => s + Number(r.restaurant_network ?? r.network ?? 0), 0);
  const totalCredit = data.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const grandTotal = totalCash + totalNet + totalCredit;
  const totalsRow = [t('total_sales'), '', `${currency}${totalCash.toLocaleString()}`, `${currency}${totalNet.toLocaleString()}`, `${currency}${totalCredit.toLocaleString()}`, `${currency}${grandTotal.toLocaleString()}`];
  return { headers, rows, totalsRow, subtitle };
}

// ─── Purchases export builders ────────────────────────────────────────────────

export function buildPurchasesCSV(data, t, currency, branches) {
  const getBranchLabel = (key) => branches.find(b => b.key === key)?.label || key;
  const headers = [t('date'), t('branch'), t('product'), t('quantity'), t('used_price'), t('total_purchase_cost')];
  const rows = data.map(p => {
    const price = p.used_price || p.current_price || 0;
    const total = (p.qty || 0) * price;
    return [p.date, getBranchLabel(p.branch), p.product_name || p.product_id, p.qty || 0, price, total];
  });
  const grandTotal = rows.reduce((s, r) => s + Number(r[5]), 0);
  rows.push(['', t('total_purchase_cost'), '', '', '', grandTotal]);
  return { headers, rows };
}

export function buildPurchasesPDF(data, t, currency, branches, subtitle) {
  const getBranchLabel = (key) => branches.find(b => b.key === key)?.label || key;
  const headers = [t('date'), t('branch'), t('product'), t('quantity'), t('used_price'), t('total_purchase_cost')];
  const rows = data.map(p => {
    const price = p.used_price || p.current_price || 0;
    const total = (p.qty || 0) * price;
    return [p.date, getBranchLabel(p.branch), p.product_name || p.product_id, String(p.qty || 0), `${currency}${price.toLocaleString()}`, `${currency}${total.toLocaleString()}`];
  });
  const grandTotal = data.reduce((s, p) => {
    const price = p.used_price || p.current_price || 0;
    return s + (p.qty || 0) * price;
  }, 0);
  const totalsRow = [t('total_purchase_cost'), '', '', '', '', `${currency}${grandTotal.toLocaleString()}`];
  return { headers, rows, totalsRow, subtitle };
}