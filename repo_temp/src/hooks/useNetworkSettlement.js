/**
 * useNetworkSettlement
 *
 * When a Daily Sales record is saved with network > 0, this hook
 * automatically:
 *   1. Creates a SettlementRecord (MANAGER_TO_SPONSOR) — deduplicates by date+branch+account
 *   2. Notifies Owner + all roles
 *
 * Returns: { autoSettle }
 */
import { base44 } from '@/api/base44Client';
import { createNotification } from '@/lib/notificationEngine';

export function useNetworkSettlement({ orgId, user, currency = 'SAR' } = {}) {

  /**
   * autoSettle — call AFTER DailySales is created/updated.
   *
   * @param {object} saleData  — the saved DailySales fields
   * @param {string} saleId    — the new/updated DailySales id
   * @param {string} proofUrl  — optional proof image URL from OCR upload
   * @param {object} ocr       — optional OCR result { amount, date, invoice_number, notes }
   * @param {object} prevSale  — previous version (for update dedup removal)
   */
  const autoSettle = async (saleData, saleId, proofUrl = null, ocr = null, prevSale = null) => {
    const networkAmount = Number(saleData.network) || 0;
    if (networkAmount <= 0) return;

    // --- Dedup: remove any previous auto-settlement for this sale ---
    if (prevSale && (Number(prevSale.network) || 0) > 0) {
      const existing = await base44.entities.SettlementRecord.filter({
        reference_id: prevSale.id,
        flow_type: 'MANAGER_TO_SPONSOR',
      });
      await Promise.all(existing.map(r => base44.entities.SettlementRecord.delete(r.id)));
    }

    // --- Create new settlement record ---
    const accountId = saleData.network_account_id || null;
    const settlement = await base44.entities.SettlementRecord.create({
      flow_type: 'MANAGER_TO_SPONSOR',
      date: saleData.date,
      amount: networkAmount,
      branch: saleData.branch,
      network_account_id: accountId || undefined,
      submitted_by: user?.email || '',
      submitted_by_name: user?.full_name || user?.email || '',
      proof_url: proofUrl || undefined,
      proof_uploaded_at: proofUrl ? new Date().toISOString() : undefined,
      reference_id: saleId,
      notes: ocr?.notes || saleData.notes || undefined,
      status: 'pending',
      ocr_vendor: ocr?.invoice_number || undefined,
    });

    // --- Notifications ---
    const branchLabel = saleData.branch || 'Branch';
    const accountLabel = accountId ? `Network #${accountId.slice(-6)}` : 'Network';
    const amtStr = `${currency} ${networkAmount.toLocaleString()}`;

    await createNotification({
      orgId,
      branch: saleData.branch,
      type: 'transfer',
      severity: 'info',
      targetRole: 'owner',
      title: `📲 ${branchLabel} — ${accountLabel}`,
      message: `${amtStr} تسویه شبکه ثبت شد — در انتظار تأیید اسپانسر`,
      amount: networkAmount,
      actorEmail: user?.email,
      actorName: user?.full_name,
      metadata: { settlement_id: settlement.id, sale_id: saleId },
    });

    return settlement;
  };

  return { autoSettle };
}