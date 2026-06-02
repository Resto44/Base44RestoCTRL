import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Download, Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/lib/LanguageContext';

function getStatusColor(status) {
  if (status === 'paid') return 'bg-green-100 text-green-700';
  if (status === 'partial') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function getStatusIcon(status) {
  if (status === 'paid') return <CheckCircle className="w-3 h-3" />;
  if (status === 'partial') return <Clock className="w-3 h-3" />;
  return <AlertTriangle className="w-3 h-3" />;
}

export default function SupplierStatement({ supplier }) {
  const { currency } = useLanguage();
  const [generating, setGenerating] = useState(false);

  const { data: invoices = [] } = useQuery({
    queryKey: ['supplier_invoices', supplier.id],
    queryFn: () => base44.entities.SupplierInvoice.filter({ supplier_id: supplier.id }, '-date', 200),
  });

  // Fetch debt records linked to this supplier by name
  const { data: debts = [] } = useQuery({
    queryKey: ['debts_supplier', supplier.name],
    queryFn: () => base44.entities.DebtRecord.filter({ party_type: 'supplier', party_name: supplier.name }, '-date', 100),
  });

  const totalInvoiced = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const overdueInvoices = invoices.filter(i => i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date());

  const generatePDF = async () => {
    setGenerating(true);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('STATEMENT OF ACCOUNT', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Supplier: ${supplier.name}`, pageW / 2, 27, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, pageW / 2, 34, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y = 52;

    // Contact info
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (supplier.phone) doc.text(`Phone: ${supplier.phone}`, 15, y); y += 5;
    if (supplier.email) doc.text(`Email: ${supplier.email}`, 15, y); y += 5;
    if (supplier.contact_name) doc.text(`Contact: ${supplier.contact_name}`, 15, y); y += 5;
    y += 5;

    // Summary box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y, pageW - 30, 28, 3, 3, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT SUMMARY', 20, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const cols = [[`Total Invoiced`, `${totalInvoiced.toLocaleString()} ${currency}`],
      [`Total Paid`, `${totalPaid.toLocaleString()} ${currency}`],
      [`Outstanding Balance`, `${totalOutstanding.toLocaleString()} ${currency}`]];
    cols.forEach(([label, val], i) => {
      const x = 20 + i * 60;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100);
      doc.text(label, x, y + 14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.setTextColor(i === 2 && totalOutstanding > 0 ? 180 : 0, i === 2 && totalOutstanding > 0 ? 0 : 0, 0);
      doc.text(val, x, y + 22);
    });
    doc.setTextColor(0, 0, 0);
    y += 36;

    // Invoice table header
    doc.setFillColor(51, 65, 85);
    doc.rect(15, y, pageW - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const headers = ['Invoice #', 'Date', 'Due Date', 'Amount', 'Paid', 'Balance', 'Status'];
    const colX = [17, 42, 65, 92, 112, 132, 158];
    headers.forEach((h, i) => doc.text(h, colX[i], y + 5.5));
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Invoice rows
    invoices.forEach((inv, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...bg);
      doc.rect(15, y - 1, pageW - 30, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const remaining = (inv.amount || 0) - (inv.paid_amount || 0);
      const row = [
        (inv.invoice_number || '-').slice(0, 10),
        inv.date || '-',
        inv.due_date || '-',
        `${(inv.amount || 0).toLocaleString()}`,
        `${(inv.paid_amount || 0).toLocaleString()}`,
        `${remaining.toLocaleString()}`,
        inv.status?.toUpperCase() || '-',
      ];
      if (inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date()) {
        doc.setTextColor(220, 38, 38);
      }
      row.forEach((val, i) => doc.text(val, colX[i], y + 5));
      doc.setTextColor(0, 0, 0);
      y += 8;
    });

    y += 8;
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('This is a computer-generated statement. Please contact us for any discrepancies.', pageW / 2, y, { align: 'center' });

    doc.save(`Statement_${supplier.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold">{totalInvoiced.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">إجمالي الفواتير</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-green-600">{totalPaid.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">المدفوع</div>
          </CardContent>
        </Card>
        <Card className={totalOutstanding > 0 ? 'border-red-200' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`text-lg font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalOutstanding.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">المتبقي</div>
          </CardContent>
        </Card>
      </div>

      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{overdueInvoices.length} فاتورة متأخرة السداد</p>
        </div>
      )}

      {/* Generate PDF Button */}
      <Button className="w-full gap-2" onClick={generatePDF} disabled={generating || invoices.length === 0}>
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {generating ? 'جاري إنشاء PDF...' : 'إنشاء كشف حساب PDF'}
      </Button>

      {/* Invoice List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">الفواتير ({invoices.length})</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد فواتير مسجلة</p>
        ) : (
          invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  {inv.invoice_number || 'بدون رقم'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {inv.date} {inv.due_date && `· استحقاق: ${inv.due_date}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold">{(inv.amount || 0).toLocaleString()} <span className="text-muted-foreground font-normal">ر.س</span></div>
                <Badge className={`text-[9px] ${getStatusColor(inv.status)}`}>
                  {getStatusIcon(inv.status)}
                  <span className="mr-1">{inv.status === 'paid' ? 'مسدد' : inv.status === 'partial' ? 'جزئي' : 'غير مسدد'}</span>
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}