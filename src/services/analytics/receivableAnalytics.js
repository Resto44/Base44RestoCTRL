import { base44 } from '@/api/base44Client';

/**
 * Fetches debt records for receivables analysis.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Debt records of type 'receivable'.
 */
export async function fetchReceivablesData(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.DebtRecord.filter(ownerFilter || {}, '-date', 1000);
  query = query.filter(d => d.type === 'receivable' && d.date >= fromDate && d.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(d => d.branch === branchKey);
  }
  return query;
}

/**
 * Fetches customer collection records.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Customer collection records.
 */
export async function fetchCustomerCollections(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.CreditCollection.filter(ownerFilter || {}, '-date', 1000);
  query = query.filter(c => c.date >= fromDate && c.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(c => c.branch === branchKey);
  }
  return query;
}

/**
 * Calculates total outstanding receivables.
 * @param {Array} debtRecords - Array of DebtRecord records.
 * @returns {number} Total outstanding amount.
 */
export function calculateOutstandingReceivables(debtRecords) {
  return debtRecords.reduce((sum, record) => {
    return sum + (record.status === 'open' ? (record.remaining_amount || 0) : 0);
  }, 0);
}

/**
 * Calculates customer receivables aging report.
 * @param {Array} debtRecords - Array of DebtRecord records.
 * @returns {object} Aging buckets.
 */
export function calculateReceivablesAging(debtRecords) {
  const now = new Date();
  const aging = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  debtRecords.filter(record => record.status === 'open').forEach(record => {
    const dueDate = new Date(record.due_date || record.date); // Use due_date if available, else date
    const diffTime = Math.abs(now - dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      aging['0-30'] += (record.remaining_amount || 0);
    } else if (diffDays <= 60) {
      aging['31-60'] += (record.remaining_amount || 0);
    } else if (diffDays <= 90) {
      aging['61-90'] += (record.remaining_amount || 0);
    } else {
      aging['90+'] += (record.remaining_amount || 0);
    }
  });

  return aging;
}

/**
 * Calculates collection rate.
 * @param {Array} customerCollections - Array of CreditCollection records.
 * @param {number} totalReceivablesIssued - Total receivables issued in the period.
 * @returns {number} Collection rate percentage.
 */
export function calculateCollectionRate(customerCollections, totalReceivablesIssued) {
  if (totalReceivablesIssued === 0) return 0;
  const totalCollected = customerCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
  return (totalCollected / totalReceivablesIssued) * 100;
}
