import React, { useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { format, subDays } from 'date-fns';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * RealDailyProfit
 *
 * Correct cash-difference accounting:
 *   cashIncrease = tonightBranchCash - previousNightBranchCash
 *
 * Real Daily Profit =
 *   networkSales + cashIncrease + creditCollections
 *   - purchases - expenses - payroll
 *
 * This prevents double-counting pre-existing remaining cash as new revenue.
 *
 * Props:
 *   walletTx      – all WalletTransaction records
 *   allSales      – all DailySales records
 *   allPurchases  – all Purchase records
 *   allExpenses   – all Expense records
 *   allPayroll    – all PayrollRun records (optional)
 *   targetDate    – 'yyyy-MM-dd' string (defaults to today)
 *   branch        – branch filter key or 'all'
 *   currency
 */
export default function RealDailyProfit({
  walletTx = [],
  allSales = [],
  allPurchases = [],
  allExpenses = [],
  allPayroll = [],
  targetDate,
  branch = 'all',
  currency,
}) {
  const { t } = useLanguage();
  const cur = currency;
  const today = targetDate || format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(today), 1), 'yyyy-MM-dd');

  // ── Branch cash wallet balance up to a given date (inclusive) ────────
  const branchCashBalanceUpTo = useMemo(() => (upToDate) => {
    return walletTx
      .filter(tx =>
        tx.wallet === 'branch_cash' &&
        tx.date <= upToDate &&
        (branch === 'all' || !tx.branch || tx.branch === branch)
      )
      .reduce((s, tx) => s + (tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0)), 0);
  }, [walletTx, branch]);

  // ── Core cash difference calculation ─────────────────────────────────
  const tonightCash = useMemo(() => branchCashBalanceUpTo(today), [branchCashBalanceUpTo, today]);
  const prevNightCash = useMemo(() => branchCashBalanceUpTo(yesterday), [branchCashBalanceUpTo, yesterday]);
  const cashIncrease = tonightCash - prevNightCash;

  // ── Today's network sales ─────────────────────────────────────────────
  const networkSales = useMemo(() =>
    allSales
      .filter(s => s.date === today && (branch === 'all' || s.branch === branch))
      .reduce((s, r) => s + (r.network || 0), 0),
    [allSales, today, branch]
  );

  // ── Today's credit collections (from wallet transactions) ─────────────
  const creditCollections = useMemo(() =>
    walletTx
      .filter(tx =>
        tx.date === today &&
        tx.type === 'credit_collection_network' &&
        (branch === 'all' || !tx.branch || tx.branch === branch)
      )
      .reduce((s, tx) => s + (tx.amount || 0), 0),
    [walletTx, today, branch]
  );

  // ── Today's purchases ─────────────────────────────────────────────────
  const purchases = useMemo(() =>
    allPurchases
      .filter(p => p.date === today && (branch === 'all' || p.branch === branch))
      .reduce((s, p) => s + (Number(p.total_amount) || (p.qty || 0) * (p.used_price || p.current_price || 0)), 0),
    [allPurchases, today, branch]
  );

  // ── Today's expenses ──────────────────────────────────────────────────
  const expenses = useMemo(() =>
    allExpenses
      .filter(e => e.date === today && (branch === 'all' || e.branch === branch || e.branch === 'all'))
      .reduce((s, e) => s + (e.amount || 0), 0),
    [allExpenses, today, branch]
  );

  // ── Today's payroll payments ──────────────────────────────────────────
  const payroll = useMemo(() =>
    allPayroll
      .filter(p => p.paid_date === today && p.status === 'paid' && (branch === 'all' || p.branch === branch))
      .reduce((s, p) => s + (p.final_salary || 0), 0),
    [allPayroll, today, branch]
  );

  // ── Real daily profit ─────────────────────────────────────────────────
  const realProfit = networkSales + cashIncrease + creditCollections - purchases - expenses - payroll;

  const Row = ({ label, value, color = 'text-foreground', sign = '', divider = false, bold = false }) => (
    <div className={`flex items-center justify-between py-1.5 ${divider ? 'border-t border-dashed border-border mt-1 pt-2' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>
        {sign}{formatCurrency(Math.abs(value), cur)}
      </span>
    </div>
  );

  return (
    <Card className="p-3 mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        {realProfit >= 0
          ? <TrendingUp className="w-4 h-4 text-emerald-600" />
          : <TrendingDown className="w-4 h-4 text-red-500" />
        }
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">سود واقعی روزانه</p>
        <span className="text-xs text-muted-foreground">(Real Daily Profit)</span>
      </div>

      {/* Cash difference section */}
      <div className="bg-white dark:bg-background rounded-lg px-3 py-2 mb-2 border border-border">
        <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
          <Info className="w-3 h-3 text-blue-500" />
          Cash Difference Logic
        </p>
        <Row label="باقی‌مانده دیشب (Previous night cash)" value={prevNightCash} color="text-slate-500" />
        <Row label="باقی‌مانده امشب (Tonight cash)" value={tonightCash} color="text-blue-600" />
        <Row
          label="افزایش نقدی واقعی (Real cash increase)"
          value={cashIncrease}
          color={cashIncrease >= 0 ? 'text-emerald-600' : 'text-red-500'}
          sign={cashIncrease < 0 ? '−' : '+'}
          bold
        />
        <p className="text-[10px] text-muted-foreground mt-1.5 italic border-t border-dashed pt-1">
          باقی‌مانده نقدی شب گذشته دوباره به عنوان فایده حساب نمی‌شود.
        </p>
      </div>

      {/* Revenue items */}
      <div className="bg-white dark:bg-background rounded-lg px-3 py-2 mb-2 border border-border">
        <p className="text-xs font-semibold text-foreground mb-1">Revenue (today)</p>
        <Row label="فروش شبکه (Network sales)" value={networkSales} color="text-blue-600" sign="+" />
        <Row label="افزایش نقدی (Cash increase)" value={cashIncrease} color={cashIncrease >= 0 ? 'text-emerald-600' : 'text-red-500'} sign={cashIncrease >= 0 ? '+' : '−'} />
        {creditCollections > 0 && (
          <Row label="وصول طلب (Credit collections)" value={creditCollections} color="text-violet-600" sign="+" />
        )}
      </div>

      {/* Cost items */}
      <div className="bg-white dark:bg-background rounded-lg px-3 py-2 mb-2 border border-border">
        <p className="text-xs font-semibold text-foreground mb-1">Costs (today)</p>
        <Row label="خریدها (Purchases)" value={purchases} color="text-amber-600" sign="−" />
        <Row label="مصارف (Expenses)" value={expenses} color="text-red-500" sign="−" />
        {payroll > 0 && (
          <Row label="معاش (Payroll)" value={payroll} color="text-red-500" sign="−" />
        )}
      </div>

      {/* Result */}
      <div className={`rounded-lg px-3 py-2.5 text-center ${realProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300' : 'bg-red-50 dark:bg-red-950/30 border border-red-300'}`}>
        <p className="text-xs text-muted-foreground mb-0.5">سود واقعی روز / Real Daily Profit</p>
        <p className={`text-2xl font-black tabular-nums ${realProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {realProfit < 0 ? '−' : ''}{formatCurrency(Math.abs(realProfit), cur)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          = Network {formatCurrency(networkSales, cur)} + Cash Δ {cashIncrease >= 0 ? '+' : '−'}{formatCurrency(Math.abs(cashIncrease), cur)} − Costs {formatCurrency(purchases + expenses + payroll, cur)}
        </p>
      </div>
    </Card>
  );
}