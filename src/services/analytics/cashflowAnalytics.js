import { base44 } from '@/api/base44Client';
import { computeBranchSettlements } from '@/components/treasury/BranchSettlementLedger';

/**
 * Fetches and processes wallet transactions and cash register entries for cash flow analysis.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<{walletTransactions: Array, cashRegisterEntries: Array}>} Raw data.
 */
async function fetchCashflowData(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let walletTxQuery = base44.entities.WalletTransaction.filter(ownerFilter || {}, '-transaction_date', 1000);
  let cashRegisterQuery = base44.entities.CashRegisterEntry.filter(ownerFilter || {}, '-date', 1000);

  walletTxQuery = walletTxQuery.filter(tx => tx.created_date >= fromDate && tx.created_date <= toDate);
  cashRegisterQuery = cashRegisterQuery.filter(entry => entry.date >= fromDate && entry.date <= toDate);

  if (branchKey !== 'all') {
    walletTxQuery = walletTxQuery.filter(tx => tx.branch === branchKey);
    cashRegisterQuery = cashRegisterQuery.filter(entry => entry.branch === branchKey);
  }

  const [walletTransactions, cashRegisterEntries] = await Promise.all([
    walletTxQuery,
    cashRegisterQuery,
  ]);

  return { walletTransactions, cashRegisterEntries };
}

/**
 * Calculates current cash balances.
 * @param {Array} walletTransactions - Array of WalletTransaction records.
 * @param {Array} branches - Array of branch objects for settlement calculation.
 * @returns {object} Current cash balances.
 */
export function calculateCashBalances(walletTransactions, branches) {
  const calc = (walletKey) => walletTransactions.filter(tx => tx.wallet === walletKey)
    .reduce((s, tx) => s + (tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0)), 0);

  const ownerNetwork = calc('owner_network');
  const ownerCash = calc('owner_cash');

  const branchMap = {};
  walletTransactions.filter(tx => tx.wallet === 'branch_cash' && tx.branch).forEach(tx => {
    if (!branchMap[tx.branch]) branchMap[tx.branch] = 0;
    branchMap[tx.branch] += tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0);
  });
  const totalBranchCash = Object.values(branchMap).reduce((s, v) => s + v, 0);

  // Settlement: total branch balances held by owner
  const settlements = computeBranchSettlements(walletTransactions, branches);
  const totalHeldByOwner = Object.values(settlements).reduce((s, v) => s + v.remaining, 0);

  return { ownerNetwork, ownerCash, totalBranchCash, totalHeldByOwner };
}

/**
 * Calculates daily cash flow for a given period.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Daily cash flow data.
 */
export async function getDailyCashFlow(ownerFilter, fromDate, toDate, branchKey = 'all') {
  const { walletTransactions, cashRegisterEntries } = await fetchCashflowData(ownerFilter, fromDate, toDate, branchKey);

  const dailyFlow = {};

  walletTransactions.forEach(tx => {
    const date = tx.created_date.split('T')[0]; // Assuming created_date is ISO string
    if (!dailyFlow[date]) dailyFlow[date] = { inflows: 0, outflows: 0, net: 0 };
    if (tx.direction === 'in') {
      dailyFlow[date].inflows += (tx.amount || 0);
    } else {
      dailyFlow[date].outflows += (tx.amount || 0);
    }
    dailyFlow[date].net = dailyFlow[date].inflows - dailyFlow[date].outflows;
  });

  cashRegisterEntries.forEach(entry => {
    const date = entry.date;
    if (!dailyFlow[date]) dailyFlow[date] = { inflows: 0, outflows: 0, net: 0 };
    if (entry.type === 'in') {
      dailyFlow[date].inflows += (entry.amount || 0);
    } else {
      dailyFlow[date].outflows += (entry.amount || 0);
    }
    dailyFlow[date].net = dailyFlow[date].inflows - dailyFlow[date].outflows;
  });

  return Object.entries(dailyFlow)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, data]) => ({ date, ...data }));
}

/**
 * Calculates cash flow summary for a given period.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} Cash flow summary.
 */
export async function getCashFlowSummary(ownerFilter, fromDate, toDate, branchKey = 'all') {
  const dailyFlow = await getDailyCashFlow(ownerFilter, fromDate, toDate, branchKey);

  const totalInflows = dailyFlow.reduce((sum, day) => sum + day.inflows, 0);
  const totalOutflows = dailyFlow.reduce((sum, day) => sum + day.outflows, 0);
  const netCashFlow = totalInflows - totalOutflows;

  return { totalInflows, totalOutflows, netCashFlow };
}
