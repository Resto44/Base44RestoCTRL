/**
 * WhatsApp Service — Debt Management Module
 * 
 * Handles sending invoices and receipts via WhatsApp.
 * If WhatsApp API is not configured, stores message in outbound queue
 * and shows "Pending WhatsApp Delivery" status.
 */

import { supabase } from '@/api/supabaseClient';

// ── Config check ──────────────────────────────────────────────────────────────
export function isWhatsAppConfigured() {
  const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY;
  const phoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID;
  return !!(apiKey && phoneId);
}

// ── Format phone number ───────────────────────────────────────────────────────
export function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  // Add country code if missing (default: Saudi Arabia 966)
  if (cleaned.startsWith('0')) {
    cleaned = '966' + cleaned.slice(1);
  } else if (!cleaned.startsWith('966') && cleaned.length === 9) {
    cleaned = '966' + cleaned;
  }
  return cleaned;
}

// ── Queue message for later delivery ─────────────────────────────────────────
export async function queueWhatsAppMessage({
  recipientPhone,
  recipientName,
  messageType,
  messageBody,
  pdfUrl,
  referenceId,
  referenceType,
  restaurantId,
  createdBy,
}) {
  try {
    const formattedPhone = formatWhatsAppNumber(recipientPhone);
    if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

    const { data, error } = await supabase
      .from('whatsapp_outbound_queue')
      .insert({
        message_type: messageType,
        recipient_phone: formattedPhone,
        recipient_name: recipientName,
        message_body: messageBody,
        pdf_url: pdfUrl,
        reference_id: referenceId,
        reference_type: referenceType,
        status: 'pending',
        restaurant_id: restaurantId,
        created_by: createdBy,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, queued: true, data };
  } catch (err) {
    console.error('[whatsappService] queueMessage error:', err);
    return { success: false, error: err.message };
  }
}

// ── Send via WhatsApp API (if configured) ─────────────────────────────────────
async function sendViaWhatsAppAPI({ phone, message, pdfUrl }) {
  const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY;
  const phoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID;
  const apiUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: pdfUrl ? 'document' : 'text',
  };

  if (pdfUrl) {
    payload.document = {
      link: pdfUrl,
      caption: message,
    };
  } else {
    payload.text = { body: message };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'WhatsApp API error');
  }

  return await response.json();
}

// ── Main: send invoice via WhatsApp ──────────────────────────────────────────
export async function sendInvoiceWhatsApp({
  invoice,
  pdfUrl,
  restaurantId,
  createdBy,
}) {
  const phone = invoice.party_phone;
  if (!phone) {
    return { success: false, status: 'no_phone', message: 'No phone number' };
  }

  const formattedPhone = formatWhatsAppNumber(phone);
  const message = buildInvoiceMessage(invoice);

  if (isWhatsAppConfigured()) {
    try {
      await sendViaWhatsAppAPI({ phone: formattedPhone, message, pdfUrl });
      // Update invoice whatsapp status
      await supabase
        .from('debt_invoices')
        .update({ whatsapp_sent: true, whatsapp_status: 'sent', whatsapp_sent_at: new Date().toISOString() })
        .eq('id', invoice.id);
      return { success: true, status: 'sent' };
    } catch (err) {
      console.error('[whatsappService] sendInvoice API error:', err);
      // Fall through to queue
    }
  }

  // Queue for later delivery
  const result = await queueWhatsAppMessage({
    recipientPhone: formattedPhone,
    recipientName: invoice.party_name,
    messageType: 'invoice',
    messageBody: message,
    pdfUrl,
    referenceId: invoice.id,
    referenceType: 'debt_invoice',
    restaurantId,
    createdBy,
  });

  // Update invoice status to pending
  await supabase
    .from('debt_invoices')
    .update({ whatsapp_sent: false, whatsapp_status: 'pending' })
    .eq('id', invoice.id);

  return { success: true, status: 'pending', queued: true, ...result };
}

// ── Main: send receipt via WhatsApp ──────────────────────────────────────────
export async function sendReceiptWhatsApp({
  receipt,
  pdfUrl,
  restaurantId,
  createdBy,
}) {
  const phone = receipt.party_phone;
  if (!phone) {
    return { success: false, status: 'no_phone', message: 'No phone number' };
  }

  const formattedPhone = formatWhatsAppNumber(phone);
  const message = buildReceiptMessage(receipt);

  if (isWhatsAppConfigured()) {
    try {
      await sendViaWhatsAppAPI({ phone: formattedPhone, message, pdfUrl });
      // Update receipt whatsapp status
      await supabase
        .from('debt_receipts')
        .update({ whatsapp_sent: true, whatsapp_status: 'sent', whatsapp_sent_at: new Date().toISOString() })
        .eq('id', receipt.id);
      return { success: true, status: 'sent' };
    } catch (err) {
      console.error('[whatsappService] sendReceipt API error:', err);
      // Fall through to queue
    }
  }

  // Queue for later delivery
  const result = await queueWhatsAppMessage({
    recipientPhone: formattedPhone,
    recipientName: receipt.party_name,
    messageType: 'receipt',
    messageBody: message,
    pdfUrl,
    referenceId: receipt.id,
    referenceType: 'debt_receipt',
    restaurantId,
    createdBy,
  });

  // Update receipt status to pending
  await supabase
    .from('debt_receipts')
    .update({ whatsapp_sent: false, whatsapp_status: 'pending' })
    .eq('id', receipt.id);

  return { success: true, status: 'pending', queued: true, ...result };
}

// ── Message builders ──────────────────────────────────────────────────────────
function buildInvoiceMessage(invoice) {
  return `🧾 *Invoice / فاتورة*
━━━━━━━━━━━━━━━━━━
📋 Invoice #: *${invoice.invoice_number}*
👤 Customer: *${invoice.party_name}*
📅 Date: ${invoice.invoice_date || new Date().toLocaleDateString()}
💰 Amount: *${Number(invoice.total_amount || 0).toLocaleString()}*
${invoice.due_date ? `⏰ Due: ${invoice.due_date}` : ''}
${invoice.description ? `📝 ${invoice.description}` : ''}
━━━━━━━━━━━━━━━━━━
Thank you for your business! 🙏`;
}

function buildReceiptMessage(receipt) {
  return `✅ *Payment Receipt / إيصال دفع*
━━━━━━━━━━━━━━━━━━
🧾 Receipt #: *${receipt.receipt_number}*
👤 Customer: *${receipt.party_name}*
📅 Date: ${receipt.receipt_date || new Date().toLocaleDateString()}
💵 Amount Paid: *${Number(receipt.amount || 0).toLocaleString()}*
💳 Method: ${receipt.payment_method || 'Cash'}
${receipt.invoice_number ? `📋 Invoice Ref: ${receipt.invoice_number}` : ''}
━━━━━━━━━━━━━━━━━━
Payment confirmed! Thank you 🙏`;
}
