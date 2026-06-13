import { base44 } from '@/api/base44Client';

/**
 * Fetches supplier invoice data for a given period and branch.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Supplier invoice records.
 */
export async function fetchSupplierInvoices(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 1000);
  query = query.filter(inv => inv.date >= fromDate && inv.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(inv => inv.branch === branchKey);
  }
  return query;
}

/**
 * Fetches supplier payment data for a given period and branch.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Supplier payment records.
 */
export async function fetchSupplierPayments(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.SupplierPayment.filter(ownerFilter || {}, '-date', 1000);
  query = query.filter(pay => pay.date >= fromDate && pay.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(pay => pay.branch === branchKey);
  }
  return query;
}

/**
 * Calculates total outstanding payables.
 * @param {Array} supplierInvoices - Array of SupplierInvoice records.
 * @returns {number} Total outstanding amount.
 */
export function calculateOutstandingPayables(supplierInvoices) {
  return supplierInvoices.reduce((sum, inv) => {
    return sum + (inv.status === 'unpaid' ? (inv.amount || 0) : 0);
  }, 0);
}

/**
 * Calculates supplier aging report.
 * @param {Array} supplierInvoices - Array of SupplierInvoice records.
 * @returns {object} Aging buckets.
 */
export function calculateSupplierAging(supplierInvoices) {
  const now = new Date();
  const aging = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  supplierInvoices.filter(inv => inv.status === 'unpaid').forEach(inv => {
    const dueDate = new Date(inv.date); // Assuming 'date' is the due date or close to it
    const diffTime = Math.abs(now - dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      aging['0-30'] += (inv.amount || 0);
    } else if (diffDays <= 60) {
      aging['31-60'] += (inv.amount || 0);
    } else if (diffDays <= 90) {
      aging['61-90'] += (inv.amount || 0);
    } else {
      aging['90+'] += (inv.amount || 0);
    }
  });

  return aging;
}

/**
 * Calculates total payments made to suppliers.
 * @param {Array} supplierPayments - Array of SupplierPayment records.
 * @returns {number} Total payments.
 */
export function calculateTotalSupplierPayments(supplierPayments) {
  return supplierPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
}
