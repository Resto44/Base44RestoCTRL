import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import {
  Plus,
  ShoppingCart,
  Wallet,
  ArrowDownLeft,
  Truck,
  FileText,
  PackagePlus,
  Banknote
} from 'lucide-react';

export default function QuickActionsDock() {
  const { t } = useLanguage();
  const location = useLocation();

  // Only show on Dashboard pages
  const isDashboard = location.pathname === '/owner-command-center' || 
                      location.pathname === '/manager-dashboard' ||
                      location.pathname === '/';

  if (!isDashboard) return null;

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
    <div className="fixed left-0 right-0 z-[9999] pointer-events-none" 
         style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-2xl mx-auto px-4 pointer-events-auto">
        <div className="bg-background/80 backdrop-blur-xl border border-border/50 shadow-[0_-8px_30px_rgb(0,0,0,0.15)] rounded-2xl overflow-hidden">
          <div className="flex overflow-x-auto hide-scrollbar gap-3 p-3 snap-x snap-mandatory">
            {actions.map((action, idx) => (
              <Link
                key={idx}
                to={action.to}
                className="flex flex-col items-center gap-1.5 min-w-[72px] snap-center active:scale-95 transition-transform"
              >
                <div className={`${action.color} p-2.5 rounded-xl text-white shadow-lg`}>
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
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
