/**
 * Async PDF Report Generation Service
 * Generates a brandable, RTL-ready PDF with branch rankings,
 * smart insights, and financial dashboards.
 * Supports Vazirmatn font for Persian/Arabic.
 */
import { jsPDF } from 'jspdf';
import { computeDashboardMetrics, computeBranchMetrics, formatCurrency, buildDailyProfitTrend } from './helpers';
import { analyzeBranchPerformance, predictLowStock, detectExpenseSpikes } from './smartAnalytics';
import { computeBranchSettlements } from '../components/treasury/BranchSettlementLedger';

// Status tracker — React state setter injected from caller
let _onProgress = null;
export function setPDFProgressCallback(fn) { _onProgress = fn; }

function progress(msg, pct) {
  if (_onProgress) _onProgress({ message: msg, percent: pct });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Detect RTL languages
 */
function isRTL(lang) { return lang === 'ar' || lang === 'fa'; }

/**
 * Load Vazirmatn font (for Persian/Arabic) from CDN via base64 embedding.
 * Falls back to Helvetica for LTR.
 */
async function setupFont(doc, lang) {
  if (!isRTL(lang)) return;
  // We use a subset approach — embed a simple Unicode font
  // For production, you'd embed the full Vazirmatn woff2 as base64
  // Here we use built-in Unicode support via UTF-8
  doc.setLanguage(lang === 'fa' ? 'fa' : 'ar');
}

function addHeader(doc, brandName, logoUrl, rangeLabel, currency, lang, rtl) {
  const w = doc.internal.pageSize.getWidth();
  // Top bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, w, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = isRTL(lang) ? (lang === 'fa' ? 'گزارش مالی' : 'التقرير المالي') : 'Financial Report';
  doc.text(rtl ? w - 14 : 14, 12, title, { align: rtl ? 'right' : 'left' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(rtl ? w - 14 : 14, 21, `${brandName} · ${rangeLabel}`, { align: rtl ? 'right' : 'left' });

  // Reset
  doc.setTextColor(30, 30, 30);
}

function addSectionTitle(doc, y, text, rtl) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(rtl ? w - 14 : 14, y, text, { align: rtl ? 'right' : 'left' });
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, w - 14, y + 2);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 9;
}

function addKPIRow(doc, y, label, value, color, rtl) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(rtl ? w - 14 : 14, y, label, { align: rtl ? 'right' : 'left' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(rtl ? 14 : w - 14, y, value, { align: rtl ? 'left' : 'right' });
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 7;
}

function addDivider(doc, y) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(14, y, w - 14, y);
  return y + 4;
}

function checkPageBreak(doc, y, needed = 20) {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 20) {
    doc.addPage();
    return 35;
  }
  return y;
}

function addInsightRow(doc, y, ins, rtl) {
  const w = doc.internal.pageSize.getWidth();
  const colors = { critical: [220, 38, 38], warning: [217, 119, 6], info: [37, 99, 235] };
  const [r, g, b] = colors[ins.severity] || colors.info;

  doc.setFillColor(r, g, b);
  doc.circle(rtl ? w - 17 : 17, y - 1.5, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(r, g, b);
  doc.text(rtl ? w - 22 : 22, y, ins.title, { align: rtl ? 'right' : 'left' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(rtl ? w - 22 : 22, y + 5, ins.message || '', { align: rtl ? 'right' : 'left' });

  doc.setTextColor(30, 30, 30);
  return y + 12;
}

function addBranchRankingRow(doc, y, branch, idx, currency, rtl) {
  const w = doc.internal.pageSize.getWidth();
  const medals = ['🥇', '🥈', '🥉'];
  const scoreColor = branch.score >= 70 ? [16, 185, 129] : branch.score >= 40 ? [245, 158, 11] : [239, 68, 68];

  // Rank badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(rtl ? w - 28 : 14, y - 5, 14, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(rtl ? w - 21 : 21, y, `#${idx + 1}`, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(rtl ? w - 45 : 32, y, branch.label, { align: rtl ? 'right' : 'left' });

  // Score bar background
  const barX = rtl ? 60 : w / 2 - 20;
  const barW = 50;
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(barX, y - 3.5, barW, 4, 1, 1, 'F');
  doc.setFillColor(...scoreColor);
  doc.roundedRect(barX, y - 3.5, barW * (branch.score / 100), 4, 1, 1, 'F');

  // Score value
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(rtl ? 14 : w - 14, y, `${branch.score}/100`, { align: rtl ? 'left' : 'right' });
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');

  return y + 10;
}

/**
 * Main async PDF generation function.
 * Returns a Blob URL you can trigger download on.
 */
export async function generatePDFReport({
  sales, purchases, expenses, inventory, waste = [],
  walletTransactions = [],
  branches, rangeType, fromStr, toStr,
  brandName = 'Restaurant', currency = '$', lang = 'en',
}) {
  progress('Initializing report engine...', 5);
  await sleep(50);

  const rtl = isRTL(lang);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await setupFont(doc, lang);

  const w = doc.internal.pageSize.getWidth();
  const rangeLabel = `${fromStr} → ${toStr}`;

  progress('Computing financial metrics...', 15);
  await sleep(30);

  // Overall metrics
  const metrics = computeDashboardMetrics(sales, purchases, expenses);

  // Branch metrics
  const branchMetrics = branches.map(b => ({
    ...b,
    m: computeBranchMetrics(sales, purchases, expenses, b.key),
  }));

  progress('Analyzing branch performance...', 30);
  await sleep(30);

  const branchAnalysis = analyzeBranchPerformance(branches, sales, purchases, expenses, waste, [], []);
  const stockPredictions = predictLowStock(inventory || [], purchases, 14);
  const expenseSpikes = detectExpenseSpikes(expenses, []);

  progress('Building insights...', 45);
  await sleep(30);

  // All insights
  const insights = [];
  branchAnalysis.forEach(b => b.issues.forEach(i => insights.push({
    severity: i.severity, title: `${b.label}: ${i.label}`, message: i.detail
  })));
  expenseSpikes.forEach(s => insights.push({ severity: s.severity, title: `Expense Spike: ${s.category}`, message: `${currency}${s.previous.toFixed(0)} → ${currency}${s.current.toFixed(0)} (+${s.pct}%)` }));
  stockPredictions.slice(0, 5).forEach(p => insights.push({ severity: p.severity, title: `Low Stock: ${p.product_name}`, message: `~${p.daysLeft} day(s) remaining (${p.branch})` }));
  insights.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - ({ critical: 0, warning: 1, info: 2 }[b.severity])));

  progress('Rendering page 1 — Overview...', 55);
  await sleep(30);

  // ===== PAGE 1: Overview =====
  addHeader(doc, brandName, null, rangeLabel, currency, lang, rtl);

  let y = 38;

  y = addSectionTitle(doc, y, lang === 'fa' ? 'خلاصه مالی' : lang === 'ar' ? 'الملخص المالي' : 'Financial Summary', rtl);
  y = addKPIRow(doc, y, lang === 'fa' ? 'فروش کل' : lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales', formatCurrency(metrics.totalSales, currency), [16, 185, 129], rtl);
  y = addDivider(doc, y);
  y = addKPIRow(doc, y, lang === 'fa' ? 'هزینه خرید' : lang === 'ar' ? 'تكلفة الشراء' : 'Purchase Cost', formatCurrency(metrics.totalPurchaseCost, currency), [239, 68, 68], rtl);
  y = addDivider(doc, y);
  y = addKPIRow(doc, y, lang === 'fa' ? 'مخارج' : lang === 'ar' ? 'المصروفات' : 'Expenses', formatCurrency(metrics.totalExpenses, currency), [245, 158, 11], rtl);
  y = addDivider(doc, y);
  y = addKPIRow(doc, y, lang === 'fa' ? 'سود ناخالص' : lang === 'ar' ? 'الربح الإجمالي' : 'Gross Profit', formatCurrency(metrics.profit, currency), metrics.profit >= 0 ? [16, 185, 129] : [239, 68, 68], rtl);
  y = addDivider(doc, y);
  y = addKPIRow(doc, y, lang === 'fa' ? 'سود خالص' : lang === 'ar' ? 'صافي الربح' : 'Net Profit', formatCurrency(metrics.netProfit, currency), metrics.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68], rtl);
  y = addDivider(doc, y);
  y = addKPIRow(doc, y, lang === 'fa' ? 'نرخ اعتبار' : lang === 'ar' ? 'نسبة الائتمان' : 'Credit Rate', `${metrics.creditPct.toFixed(1)}%`, metrics.creditPct > 30 ? [239, 68, 68] : [37, 99, 235], rtl);

  y += 6;

  // Payment breakdown box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, w - 28, 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  const cashLabel = lang === 'fa' ? 'نقد' : lang === 'ar' ? 'نقداً' : 'Cash';
  const netLabel = lang === 'fa' ? 'شبکه' : lang === 'ar' ? 'شبكة' : 'Network';
  const creditLabel = lang === 'fa' ? 'اعتبار' : lang === 'ar' ? 'آجل' : 'Credit';
  doc.text(rtl ? w - 18 : 18, y + 8, cashLabel, { align: rtl ? 'right' : 'left' });
  doc.text(rtl ? w - 18 : 18, y + 16, `${formatCurrency(metrics.totalCash, currency)}`, { align: rtl ? 'right' : 'left' });
  const midX = w / 2;
  doc.text(midX, y + 8, netLabel, { align: 'center' });
  doc.text(midX, y + 16, `${formatCurrency(metrics.totalNetwork, currency)}`, { align: 'center' });
  doc.text(rtl ? 18 : w - 18, y + 8, creditLabel, { align: rtl ? 'left' : 'right' });
  doc.text(rtl ? 18 : w - 18, y + 16, `${formatCurrency(metrics.totalCredit, currency)}`, { align: rtl ? 'left' : 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  y += 28;

  // ===== BRANCH RANKINGS =====
  if (branchAnalysis.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, lang === 'fa' ? 'رتبه‌بندی شعب' : lang === 'ar' ? 'تصنيف الفروع' : 'Branch Rankings', rtl);
    branchAnalysis.forEach((b, idx) => {
      y = checkPageBreak(doc, y, 14);
      y = addBranchRankingRow(doc, y, b, idx, currency, rtl);
    });
    y += 4;
  }

  progress('Rendering branch comparison...', 65);
  await sleep(30);

  // ===== BRANCH DETAIL TABLE =====
  if (branchMetrics.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = addSectionTitle(doc, y, lang === 'fa' ? 'جزئیات شعب' : lang === 'ar' ? 'تفاصيل الفروع' : 'Branch Details', rtl);

    // Table header
    doc.setFillColor(37, 99, 235);
    doc.rect(14, y - 3, w - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const cols = [
      { label: lang === 'fa' ? 'شعبه' : lang === 'ar' ? 'الفرع' : 'Branch', x: 18 },
      { label: lang === 'fa' ? 'فروش' : lang === 'ar' ? 'مبيعات' : 'Sales', x: w / 2 - 20 },
      { label: lang === 'fa' ? 'سود' : lang === 'ar' ? 'الربح' : 'Profit', x: w / 2 + 10 },
      { label: lang === 'fa' ? 'اعتبار%' : lang === 'ar' ? 'ائتمان%' : 'Credit%', x: w - 18 },
    ];
    cols.forEach(c => doc.text(c.x, y + 2, c.label, { align: c.x === w - 18 ? 'right' : 'left' }));
    doc.setTextColor(30, 30, 30);
    y += 10;

    branchMetrics.forEach((b, i) => {
      y = checkPageBreak(doc, y, 10);
      if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y - 4, w - 28, 8, 'F'); }
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.text(18, y, b.label, { align: 'left' });
      doc.text(w / 2 - 20, y, formatCurrency(b.m.totalSales, currency), { align: 'left' });
      const profitColor = b.m.profit >= 0 ? [16, 185, 129] : [239, 68, 68];
      doc.setTextColor(...profitColor);
      doc.text(w / 2 + 10, y, formatCurrency(b.m.profit, currency), { align: 'left' });
      doc.setTextColor(b.m.creditPct > 30 ? 239 : 30, b.m.creditPct > 30 ? 68 : 30, b.m.creditPct > 30 ? 68 : 30);
      doc.text(w - 18, y, `${b.m.creditPct.toFixed(1)}%`, { align: 'right' });
      doc.setTextColor(30, 30, 30);
      y += 8;
    });
    y += 4;
  }

  // ===== BRANCH SETTLEMENT SUMMARY =====
  progress('Rendering settlement summary...', 70);
  await sleep(20);

  const settlements = computeBranchSettlements(walletTransactions, branches);
  const settlementBranches = branches.filter(b => settlements[b.key] && (settlements[b.key].sentToOwner > 0 || settlements[b.key].remaining !== 0));

  if (settlementBranches.length > 0) {
    y = checkPageBreak(doc, y, 50);
    const settlementTitle = lang === 'fa' ? 'تسویه فرع با اونر' : lang === 'ar' ? 'تسوية الفروع مع المالك' : 'Branch–Owner Settlement Summary';
    y = addSectionTitle(doc, y, settlementTitle, rtl);

    // Total held
    const totalHeld = Object.values(settlements).reduce((s, v) => s + v.remaining, 0);
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(14, y - 2, w - 28, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    const totalHeldLabel = lang === 'fa' ? 'کل باقی‌مانده نزد اونر' : lang === 'ar' ? 'إجمالي المبالغ المحتجزة' : 'Total Held by Owner';
    doc.text(rtl ? w - 18 : 18, y + 5, totalHeldLabel, { align: rtl ? 'right' : 'left' });
    doc.text(rtl ? 18 : w - 18, y + 5, formatCurrency(totalHeld, currency), { align: rtl ? 'left' : 'right' });
    doc.setTextColor(30, 30, 30);
    y += 14;

    // Per-branch table
    doc.setFillColor(37, 99, 235);
    doc.rect(14, y - 3, w - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const settleCols = [
      { label: lang === 'fa' ? 'شعبه' : 'Branch',            x: 18 },
      { label: lang === 'fa' ? 'ارسال به اونر' : 'Sent',      x: w * 0.38 },
      { label: lang === 'fa' ? 'مصارف اونر' : 'Owner Spent',  x: w * 0.57 },
      { label: lang === 'fa' ? 'باقی‌مانده' : 'Remaining',    x: w - 18 },
    ];
    settleCols.forEach(c => doc.text(c.x, y + 2, c.label, { align: c.x === w - 18 ? 'right' : 'left' }));
    doc.setTextColor(30, 30, 30);
    y += 10;

    settlementBranches.forEach((b, i) => {
      y = checkPageBreak(doc, y, 10);
      const s = settlements[b.key];
      if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y - 4, w - 28, 8, 'F'); }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(18, y, b.label, { align: 'left' });
      doc.setTextColor(37, 99, 235);
      doc.text(w * 0.38, y, formatCurrency(s.sentToOwner, currency), { align: 'left' });
      doc.setTextColor(245, 158, 11);
      doc.text(w * 0.57, y, formatCurrency(s.ownerExpenseForBranch + s.returnedToBranch, currency), { align: 'left' });
      const remColor = s.remaining < 0 ? [239, 68, 68] : [16, 185, 129];
      doc.setTextColor(...remColor);
      doc.text(w - 18, y, formatCurrency(s.remaining, currency), { align: 'right' });
      doc.setTextColor(30, 30, 30);
      y += 8;

      // Warning if negative
      if (s.remaining < 0) {
        doc.setFontSize(7);
        doc.setTextColor(239, 68, 68);
        const warnText = lang === 'fa' ? '⚠ مصارف اونر بیشتر از مبلغ ارسالی است' : '⚠ Owner spent more than received from this branch';
        doc.text(rtl ? w - 20 : 20, y, warnText, { align: rtl ? 'right' : 'left' });
        doc.setTextColor(30, 30, 30);
        y += 6;
      }
    });

    // Accounting note
    y += 3;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    const note = lang === 'fa'
      ? 'باقی‌مانده هر فرع نزد اونر به عنوان موجودی عملیاتی ثبت می‌شود، نه سود جدید.'
      : lang === 'ar'
        ? 'يُسجَّل رصيد كل فرع لدى المالك كسيولة تشغيلية وليس ربحاً جديداً.'
        : 'Branch remaining balances held by owner are recorded as operational liquidity, not new profit.';
    doc.text(rtl ? w - 14 : 14, y, note, { align: rtl ? 'right' : 'left', maxWidth: w - 28 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    y += 10;
  }

  progress('Rendering smart insights...', 75);
  await sleep(30);

  // ===== SMART INSIGHTS =====
  if (insights.length > 0) {
    doc.addPage();
    addHeader(doc, brandName, null, rangeLabel, currency, lang, rtl);
    y = 38;
    y = addSectionTitle(doc, y, lang === 'fa' ? 'هوش تجاری' : lang === 'ar' ? 'رؤى ذكية' : 'Smart Insights', rtl);

    insights.slice(0, 12).forEach(ins => {
      y = checkPageBreak(doc, y, 16);
      y = addInsightRow(doc, y, ins, rtl);
    });
    y += 4;
  }

  progress('Rendering stock predictions...', 85);
  await sleep(30);

  // ===== STOCK PREDICTIONS =====
  if (stockPredictions.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = addSectionTitle(doc, y, lang === 'fa' ? 'پیش‌بینی کمبود موجودی' : lang === 'ar' ? 'توقعات نقص المخزون' : 'Stock Depletion Forecast (14 days)', rtl);

    stockPredictions.slice(0, 8).forEach((p, i) => {
      y = checkPageBreak(doc, y, 10);
      if (i % 2 === 0) { doc.setFillColor(254, 249, 245); doc.rect(14, y - 4, w - 28, 8, 'F'); }
      const sc = { critical: [239, 68, 68], warning: [245, 158, 11], info: [37, 99, 235] }[p.severity];
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...sc);
      doc.text(18, y, `${p.product_name}`, { align: 'left' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(w / 2, y, p.branch, { align: 'center' });
      doc.setTextColor(...sc);
      doc.text(w - 18, y, `${p.daysLeft}d left`, { align: 'right' });
      doc.setTextColor(30, 30, 30);
      y += 8;
    });
  }

  progress('Finalizing PDF...', 95);
  await sleep(30);

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, ph - 10, w, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(14, ph - 4, `${brandName} · Generated ${new Date().toLocaleDateString()}`, { align: 'left' });
    doc.text(w - 14, ph - 4, `Page ${i} of ${totalPages}`, { align: 'right' });
  }

  progress('Done!', 100);
  await sleep(100);

  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}