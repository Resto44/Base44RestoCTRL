/**
 * Order PDF Receipt Generator — Online Ordering V2
 * Smart Restaurant ERP — Integrated Module
 * Generates PDF receipts for orders using jsPDF.
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';

/**
 * Generate a PDF receipt for an order.
 * @param {Object} orderData - The order data object from buildOrderPDFData()
 * @returns {jsPDF} - The jsPDF document instance
 */
export function generateOrderPDF(orderData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 10;

  const centerText = (text, yPos, fontSize = 10) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, yPos);
  };

  const line = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  };

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  centerText(orderData.restaurant.name, y, 14);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (orderData.restaurant.address) {
    centerText(orderData.restaurant.address, y, 8);
    y += 4;
  }
  if (orderData.restaurant.phone) {
    centerText(orderData.restaurant.phone, y, 8);
    y += 4;
  }

  y += 2;
  line();

  // ── Order Info ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  centerText(`ORDER RECEIPT`, y, 11);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Order #: ${orderData.orderNumber}`, margin, y);
  doc.text(`Date: ${orderData.date}`, pageWidth - margin - 40, y);
  y += 5;

  doc.text(`Customer: ${orderData.customer.name}`, margin, y);
  y += 4;
  if (orderData.customer.phone) {
    doc.text(`Phone: ${orderData.customer.phone}`, margin, y);
    y += 4;
  }
  if (orderData.customer.address) {
    const addrLines = doc.splitTextToSize(`Address: ${orderData.customer.address}`, pageWidth - 2 * margin);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 4;
  }

  y += 2;
  line();

  // ── Items ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Item', margin, y);
  doc.text('Qty', pageWidth / 2 - 10, y);
  doc.text('Price', pageWidth - margin - 20, y);
  doc.text('Total', pageWidth - margin, y, { align: 'right' });
  y += 2;
  line();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  orderData.items.forEach(item => {
    const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    doc.text(name, margin, y);
    doc.text(String(item.qty), pageWidth / 2 - 10, y);
    doc.text(`${item.unitPrice.toFixed(2)}`, pageWidth - margin - 20, y);
    doc.text(`${item.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  });

  y += 1;
  line();

  // ── Totals ───────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  const addTotalRow = (label, value, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    doc.text(label, pageWidth / 2, y);
    doc.text(`${value} SAR`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  };

  addTotalRow('Subtotal:', orderData.subtotal.toFixed(2));
  if (orderData.deliveryFee > 0) addTotalRow('Delivery Fee:', orderData.deliveryFee.toFixed(2));
  if (orderData.tax > 0) addTotalRow('VAT (15%):', orderData.tax.toFixed(2));
  if (orderData.discount > 0) addTotalRow('Discount:', `-${orderData.discount.toFixed(2)}`);
  if (orderData.walletUsed > 0) addTotalRow('Wallet:', `-${orderData.walletUsed.toFixed(2)}`);

  line();
  addTotalRow('TOTAL:', orderData.total.toFixed(2), true);

  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Payment: ${orderData.paymentMethod?.toUpperCase()}`, margin, y);
  doc.text(`Status: ${orderData.status?.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // ── Footer ───────────────────────────────────────────────────────────────
  line();
  doc.setFontSize(8);
  centerText('Thank you for your order!', y, 8);
  y += 4;
  centerText('Powered by Smart Restaurant ERP', y, 7);

  return doc;
}

/**
 * Download the PDF receipt.
 */
export function downloadOrderPDF(orderData) {
  const doc = generateOrderPDF(orderData);
  doc.save(`receipt-${orderData.orderNumber}.pdf`);
}

/**
 * Open the PDF in a new tab for printing/sharing.
 */
export function openOrderPDF(orderData) {
  const doc = generateOrderPDF(orderData);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/**
 * Get PDF as base64 string for sharing (e.g., WhatsApp).
 */
export function getOrderPDFBase64(orderData) {
  const doc = generateOrderPDF(orderData);
  return doc.output('datauristring');
}

/**
 * Share PDF via WhatsApp (opens WhatsApp with a message).
 */
export function shareOrderPDFWhatsApp(orderData, phone) {
  const message = encodeURIComponent(
    `Your order receipt for ${orderData.orderNumber} from ${orderData.restaurant.name}. Total: ${orderData.total.toFixed(2)} SAR`
  );
  const phoneClean = phone?.replace(/\D/g, '');
  window.open(`https://wa.me/${phoneClean}?text=${message}`, '_blank');
}
