import React, { memo, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, BarChart3, MoreHorizontal, Wallet, Users, Truck,
  ChefHat, ShoppingBag, ClipboardList, UserCheck, Bell, Bot, Building2,
  Package, CreditCard, ShoppingCart, Star, Grid3x3, X,
  TrendingUp, Calendar, Utensils, Zap
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole, ROLES } from '@/lib/RoleContext';

const PRIMARY_NAV = {
  [ROLES.OWNER]: [
    { path: '/owner-command-center', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',                icon: Receipt,          labelKey: 'sales' },
    { path: '/smart-alerts',         icon: Bell,             labelKey: 'alerts' },
    { path: '/ai-copilot',           icon: Bot,              labelKey: 'ai_copilot' },
    { path: '/more',                 icon: Grid3x3,          labelKey: 'more', isMore: true },
  ],
  [ROLES.MANAGER]: [
    { path: '/manager-dashboard',    icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',                icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',             icon: Truck,           labelKey: 'delivery' },
    { path: '/employees',            icon: Users,           labelKey: 'employees' },
    { path: '/more',                 icon: Grid3x3,         labelKey: 'more', isMore: true },
  ],
  [ROLES.EMPLOYEE]: [
    { path: '/employee-dashboard',   icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/employee-attendance',  icon: UserCheck,       labelKey: 'attendance' },
    { path: '/tasks',                icon: ClipboardList,   labelKey: 'tasks' },
  ],
  [ROLES.DRIVER]: [
    { path: '/driver-dashboard',     icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/delivery',             icon: Truck,           labelKey: 'delivery' },
  ],
  [ROLES.SPONSOR]: [
    { path: '/sponsor-dashboard',    icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sponsor-treasury',     icon: Wallet,          labelKey: 'treasury' },
  ],
  [ROLES.KITCHEN]: [
    { path: '/kds',                  icon: ChefHat,         labelKey: 'kds' },
    { path: '/kitchen-dashboard',    icon: LayoutDashboard, labelKey: 'dashboard' },
  ],
  [ROLES.CUSTOMER]: [
    { path: '/online-ordering',      icon: ShoppingBag,     labelKey: 'menu_page' },
    { path: '/customer-dashboard',   icon: LayoutDashboard, labelKey: 'dashboard' },
  ],
};

const MORE_SECTIONS_OWNER = [
  {
    title: 'Operations',
    items: [
      { path: '/cash-register',            icon: CreditCard,  labelKey: 'cash_register' },
      { path: '/kds',                      icon: ChefHat,     labelKey: 'kds' },
      { path: '/online-ordering',          icon: ShoppingCart,labelKey: 'online_ordering' },
      { path: '/reservations',             icon: Calendar,    labelKey: 'reservations' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { path: '/network-hub',              icon: Building2,   labelKey: 'network_management' },
      { path: '/bi-center',                icon: BarChart3,   labelKey: 'bi_center' },
      { path: '/branch-command-center',    icon: Building2,   labelKey: 'branch_command_center' },
      { path: '/reports',                  icon: TrendingUp,  labelKey: 'reports' },
      { path: '/profit-loss',              icon: Wallet,      labelKey: 'profit_loss' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { path: '/product-management',       icon: Package,     labelKey: 'product_management' },
      { path: '/inventory-command-center', icon: Package,     labelKey: 'inventory_command_center' },
      { path: '/recipe-food-costing',      icon: Utensils,    labelKey: 'recipe_food_costing' },
      { path: '/inventory',                icon: Package,     labelKey: 'inventory' },
      { path: '/suppliers',                icon: Truck,       labelKey: 'suppliers' },
    ],
  },
  {
    title: 'People & Finance',
    items: [
      { path: '/driver-management',        icon: Truck,       labelKey: 'driver_management' },
      { path: '/customer-management',      icon: Star,        labelKey: 'customer_management' },
      { path: '/employees',                icon: Users,       labelKey: 'employees' },
      { path: '/debt-management',           icon: CreditCard,  labelKey: 'debt_management' },
      { path: '/treasury',                 icon: Wallet,      labelKey: 'treasury' },
      { path: '/payroll',                  icon: Receipt,     labelKey: 'payroll' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { path: '/settings',                 icon: Zap,         labelKey: 'settings' },
      { path: '/branch-management',        icon: Building2,   labelKey: 'branches' },
      { path: '/billing',                  icon: CreditCard,  labelKey: 'billing' },
    ],
  },
];

const MORE_SECTIONS_MANAGER = [
  {
    title: 'Operations',
    items: [
      { path: '/cash-register',    icon: CreditCard,  labelKey: 'cash_register' },
      { path: '/kds',              icon: ChefHat,     labelKey: 'kds' },
      { path: '/reservations',     icon: Calendar,    labelKey: 'reservations' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { path: '/product-management', icon: Package,   labelKey: 'product_management' },
      { path: '/inventory',          icon: Package,   labelKey: 'inventory' },
      { path: '/inventory-waste',    icon: Package,   labelKey: 'waste_tracking' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { path: '/treasury',         icon: Wallet,      labelKey: 'treasury' },
      { path: '/expenses',         icon: Receipt,     labelKey: 'expenses' },
      { path: '/reports',          icon: BarChart3,   labelKey: 'reports' },
    ],
  },
];

function MoreMenu({ sections, onClose }) {
  const { t } = useLanguage();
  const location = useLocation();
  return (
    <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose}>
      <div
        className="absolute bottom-16 left-0 right-0 bg-background rounded-t-2xl max-h-[75vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold">{t('more')}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 pb-8">
          {sections.map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                      <span className="text-[10px] font-medium text-center leading-tight">
                        {t(item.labelKey)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BottomNav = memo(function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { role } = useRole();
  const [showMore, setShowMore] = useState(false);

  const visibleNav = useMemo(() => PRIMARY_NAV[role] || PRIMARY_NAV[ROLES.OWNER], [role]);
  const moreSections = role === ROLES.MANAGER ? MORE_SECTIONS_MANAGER : MORE_SECTIONS_OWNER;

  return (
    <>
      {showMore && <MoreMenu sections={moreSections} onClose={() => setShowMore(false)} />}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {visibleNav.map(({ path, icon: NavIcon, labelKey, isMore }) => {
            if (isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(s => !s)}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                    showMore ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <NavIcon className={`w-5 h-5 ${showMore ? 'stroke-[2.5]' : ''}`} />
                  <span className={`text-[10px] mt-1 ${showMore ? 'font-semibold' : 'font-medium'}`}>
                    {t(labelKey)}
                  </span>
                </button>
              );
            }
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <NavIcon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {t(labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
});

export default BottomNav;
