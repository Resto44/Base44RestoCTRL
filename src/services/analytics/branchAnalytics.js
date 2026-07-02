import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { computeBranchMetrics } from '@/lib/helpers';

/**
 * Fetches all necessary data for branch performance analysis.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @returns {Promise<{sales: Array, purchases: Array, expenses: Array, waste: Array, debtRecords: Array, creditCollections: Array}>} Raw data.
 */
async function fetchBranchPerformanceData(ownerFilter, fromDate, toDate) {
  const [allSales, allPurchases, allExpenses, allWaste, allDebtRecords, allCreditCollections] = await Promise.all([
    base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    supabase
      .from('supplier_invoices')
      .select('*')
      .eq('created_by', ownerFilter?.created_by)
      .in('approval_status', ['approved', 'auto_approved'])
      .order('date', { ascending: false })
      .limit(1000)
      .then(({ data }) => data || []),
    base44.entities.Expense.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.InventoryWaste.filter(ownerFilter || {}, '-date', 500),
    base44.entities.DebtRecord.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.CreditCollection.filter(ownerFilter || {}, '-date', 1000),
  ]);

  const sales = allSales.filter(s => s.date >= fromDate && s.date <= toDate);
  const purchases = allPurchases.filter(p => p.date >= fromDate && p.date <= toDate);
  const expenses = allExpenses.filter(e => e.date >= fromDate && e.date <= toDate);
  const waste = allWaste.filter(w => w.date >= fromDate && w.date <= toDate);
  const debtRecords = allDebtRecords.filter(d => d.date >= fromDate && d.date <= toDate);
  const creditCollections = allCreditCollections.filter(c => c.date >= fromDate && c.date <= toDate);

  return { sales, purchases, expenses, waste, debtRecords, creditCollections };
}

/**
 * Calculates comprehensive metrics for a single branch.
 * @param {Array} allSales - All sales records.
 * @param {Array} allPurchases - All purchase records.
 * @param {Array} allExpenses - All expense records.
 * @param {Array} allWaste - All inventory waste records.
 * @param {Array} allDebtRecords - All debt records.
 * @param {Array} allCreditCollections - All credit collection records.
 * @param {string} branchKey - The key of the branch to analyze.
 * @returns {object} Comprehensive branch metrics.
 */
export function calculateBranchMetrics(allSales, allPurchases, allExpenses, allWaste, allDebtRecords, allCreditCollections, branchKey) {
  const branchSales = allSales.filter(s => s.branch === branchKey);
  const branchPurchases = allPurchases.filter(p => p.branch === branchKey);
  const branchExpenses = allExpenses.filter(e => e.branch === branchKey || e.branch === 'all'); // Expenses can be branch-specific or 'all'
  const branchWaste = allWaste.filter(w => w.branch === branchKey);
  const branchDebtRecords = allDebtRecords.filter(d => d.branch === branchKey);
  const branchCreditCollections = allCreditCollections.filter(c => c.branch === branchKey);

  const metrics = computeBranchMetrics(branchSales, branchPurchases, branchExpenses, branchKey);

  const totalWasteLoss = branchWaste.reduce((s, w) => s + (w.total_loss || 0), 0);
  const totalCollections = branchCreditCollections.reduce((s, c) => s + (c.amount || 0), 0);
  const outstandingReceivables = branchDebtRecords.filter(d => d.status === 'open' && d.type === 'receivable').reduce((s, d) => s + (d.remaining_amount || 0), 0);

  return {
    ...metrics,
    totalWasteLoss,
    totalCollections,
    outstandingReceivables,
    // Add more branch-specific metrics as needed
  };
}

/**
 * Generates a performance ranking for all branches.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {Array} allBranches - List of all active branches.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @returns {Promise<Array>} Ranked list of branches with their performance metrics.
 */
export async function getBranchPerformanceRankings(ownerFilter, allBranches, fromDate, toDate) {
  const { sales, purchases, expenses, waste, debtRecords, creditCollections } = await fetchBranchPerformanceData(ownerFilter, fromDate, toDate);

  const branchRankings = allBranches.map(branch => {
    const branchMetrics = calculateBranchMetrics(sales, purchases, expenses, waste, debtRecords, creditCollections, branch.key);
    
    // Simple scoring mechanism for ranking (can be made more complex)
    let score = 0;
    score += branchMetrics.profit * 0.4; // 40% weight on profit
    score += branchMetrics.totalSales * 0.2; // 20% weight on sales
    score -= branchMetrics.totalWasteLoss * 0.1; // 10% penalty on waste
    score += branchMetrics.totalCollections * 0.15; // 15% weight on collections
    score -= branchMetrics.outstandingReceivables * 0.15; // 15% penalty on outstanding receivables

    return {
      branchKey: branch.key,
      branchLabel: branch.label,
      ...branchMetrics,
      score,
    };
  });

  return branchRankings.sort((a, b) => b.score - a.score);
}
