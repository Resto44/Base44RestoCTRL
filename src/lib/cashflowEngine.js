/**
 * Running Cashflow Engine
 * Computes daily running balances per branch.
 *
 * Cash Balance formula per day:
 *   newCash = prevCash + cashSales + creditCollectionsToCash
 *             - cashExpenses - cashPurchases
 *
 * Network Balance formula per day:
 *   newNetwork = prevNetwork + networkSales + creditCollectionsToNetwork
 *               - networkExpenses - networkPurchases
 */

export function computeRunningCashflow({
  sales = [],
  purchases = [],
  expenses = [],
  collections = [],
  branch = null,
  fromStr,
  toStr,
}) {
  // Filter by branch
  const filterBranch = (arr, field = 'branch') =>
    branch ? arr.filter(r => r[field] === branch) : arr;

  const bSales = filterBranch(sales);
  const bPurch = filterBranch(purchases);
  const bExp = branch
    ? expenses.filter(e => e.branch === branch || e.branch === 'all')
    : expenses;
  const bColl = filterBranch(collections);

  // Build sorted date list
  const allDates = new Set();
  [...bSales, ...bPurch, ...bExp, ...bColl].forEach(r => {
    if (r.date && r.date >= fromStr && r.date <= toStr) allDates.add(r.date);
  });
  const sortedDates = [...allDates].sort();

  let cashBalance = 0;
  let networkBalance = 0;
  const rows = [];

  for (const date of sortedDates) {
    const daySales = bSales.filter(s => s.date === date);
    const dayPurch = bPurch.filter(p => p.date === date);
    const dayExp = bExp.filter(e => e.date === date);
    const dayColl = bColl.filter(c => c.date === date);

    const cashIn = daySales.reduce((s, r) => s + (r.cash || 0), 0);
    const networkIn = daySales.reduce((s, r) => s + (r.network || 0), 0);
    const creditIn = daySales.reduce((s, r) => s + (r.credit || 0), 0);

    const collCash = dayColl.filter(c => c.received_via === 'cash').reduce((s, c) => s + (c.amount || 0), 0);
    const collNetwork = dayColl.filter(c => c.received_via === 'network').reduce((s, c) => s + (c.amount || 0), 0);

    const cashExpOut = dayExp.filter(e => !e.payment_method || e.payment_method === 'cash').reduce((s, e) => s + (e.amount || 0), 0);
    const networkExpOut = dayExp.filter(e => e.payment_method === 'network').reduce((s, e) => s + (e.amount || 0), 0);

    const cashPurchOut = dayPurch.filter(p => !p.payment_method || p.payment_method === 'cash').reduce((s, p) => s + ((p.qty || 0) * (p.used_price || p.current_price || 0)), 0);
    const networkPurchOut = dayPurch.filter(p => p.payment_method === 'network').reduce((s, p) => s + ((p.qty || 0) * (p.used_price || p.current_price || 0)), 0);

    const openCash = cashBalance;
    const openNetwork = networkBalance;

    cashBalance = cashBalance + cashIn + collCash - cashExpOut - cashPurchOut;
    networkBalance = networkBalance + networkIn + collNetwork - networkExpOut - networkPurchOut;

    rows.push({
      date,
      openCash,
      openNetwork,
      cashIn,
      networkIn,
      creditIn,
      collCash,
      collNetwork,
      cashExpOut,
      networkExpOut,
      cashPurchOut,
      networkPurchOut,
      closeCash: cashBalance,
      closeNetwork: networkBalance,
      netCashFlow: cashBalance - openCash,
      netNetworkFlow: networkBalance - openNetwork,
    });
  }

  const totalCashIn = rows.reduce((s, r) => s + r.cashIn + r.collCash, 0);
  const totalCashOut = rows.reduce((s, r) => s + r.cashExpOut + r.cashPurchOut, 0);
  const totalNetworkIn = rows.reduce((s, r) => s + r.networkIn + r.collNetwork, 0);
  const totalNetworkOut = rows.reduce((s, r) => s + r.networkExpOut + r.networkPurchOut, 0);

  return {
    rows,
    summary: {
      openingCash: rows[0]?.openCash ?? 0,
      openingNetwork: rows[0]?.openNetwork ?? 0,
      closingCash: cashBalance,
      closingNetwork: networkBalance,
      totalCashIn,
      totalCashOut,
      totalNetworkIn,
      totalNetworkOut,
      netCash: cashBalance,
      netNetwork: networkBalance,
    },
  };
}