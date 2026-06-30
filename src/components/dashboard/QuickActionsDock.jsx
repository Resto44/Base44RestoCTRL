import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import {
  Plus,
  ShoppingCart,
  Wallet,
  ArrowDownLeft,
  Truck,
  FileText,
  PackagePlus,
  Banknote,
  DollarSign
} from 'lucide-react';

export default function QuickActionsDock() {
  const { t } = useLanguage();

  const actions = [
    { to: '/sales', label: t('add_sales') || 'Add Sale', icon: Plus, color: 'bg-emerald-500' },
    { to: '/enterprise-purchases', label: t('add_purchase') || 'Add Purchase', icon: ShoppingCart, color: 'bg-blue-500' },
    { to: '/expenses', label: t('add_expense') || 'Add Expense', icon: Wallet, color: 'bg-amber-500' },
    { to: '/debts', label: t('receive_debt') || 'Receive Debt', icon: ArrowDownLeft, color: 'bg-cyan-500' },
    { to: '/suppliers', label: t('supplier_payment') || 'Supplier Payment', icon: Truck, color: 'bg-orange-500' },
    { to: '/sales/invoices', label: t('create_invoice') || 'Create Invoice', icon: FileText, color: 'bg-violet-500' },
    { to: '/product-management', label: t('add_product') || 'Add Product', icon: PackagePlus, color: 'bg-indigo-500' },
    { to: '/treasury', label: t('treasury') || 'Treasury', icon: Banknote, color: 'bg-rose-500' },
  ];

  return (
    <>
      {/* Mobile/Tablet Fixed Dock */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-safe pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="bg-background/80 backdrop-blur-xl border border-border/50 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-2xl overflow-hidden">
            <div className="flex overflow-x-auto hide-scrollbar gap-3 p-3 snap-x snap-mandatory">
              {actions.map((action, idx) => (
                <Link
                  key={idx}
                  to={action.to}
                  className="flex flex-col items-center gap-1.5 min-w-[72px] snap-center active:scale-95 transition-transform"
                >
                  <div className={`${action.color} p-2.5 rounded-xl text-white shadow-lg shadow-${action.color.split('-')[1]}-500/20`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight whitespace-nowrap px-1">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sticky Dock */}
      <div className="hidden md:block sticky bottom-0 z-40 -mx-4 px-4 py-4 bg-background/80 backdrop-blur-md border-t border-border/50 shadow-[0_-4px_20px_rgb(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar pb-1">
            {actions.map((action, idx) => (
              <Link
                key={idx}
                to={action.to}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors whitespace-nowrap group"
              >
                <div className={`${action.color} p-1.5 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </>
  );
}
