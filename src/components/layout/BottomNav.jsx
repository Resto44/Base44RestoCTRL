import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, MoreHorizontal, Wallet, Users, Truck, Home, ChefHat, ShoppingBag, ClipboardList, UserCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole, ROLES } from '@/lib/RoleContext';

// Clean enterprise navigation — 5 items max per role
const NAV_BY_ROLE = {
  [ROLES.OWNER]: [
    { path: '/owner-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',           icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',        icon: Truck,           labelKey: 'delivery' },
    { path: '/treasury',        icon: Wallet,          labelKey: 'treasury' },
    { path: '/settings',        icon: MoreHorizontal,  labelKey: 'settings' },
  ],
  [ROLES.MANAGER]: [
    { path: '/manager-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',             icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',          icon: Truck,           labelKey: 'delivery' },
    { path: '/employees',         icon: Users,           labelKey: 'employees' },
    { path: '/reports',           icon: BarChart3,       labelKey: 'reports' },
  ],
  [ROLES.EMPLOYEE]: [
    { path: '/employee-dashboard',  icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/employee-attendance', icon: UserCheck,       labelKey: 'attendance' },
    { path: '/tasks',               icon: ClipboardList,   labelKey: 'tasks' },
    { path: '/employee',            icon: Home,            labelKey: 'home' },
  ],
  [ROLES.DRIVER]: [
    { path: '/driver-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/delivery',         icon: Truck,           labelKey: 'delivery' },
    { path: '/driver',           icon: Home,            labelKey: 'home' },
  ],
  [ROLES.SPONSOR]: [
    { path: '/sponsor-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sponsor-treasury',  icon: Wallet,          labelKey: 'treasury' },
  ],
  [ROLES.KITCHEN]: [
    { path: '/kitchen-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/kitchen',           icon: ChefHat,         labelKey: 'kitchen' },
  ],
  [ROLES.CUSTOMER]: [
    { path: '/customer-dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/customer',           icon: ShoppingBag,     labelKey: 'menu' },
  ],
};

export default function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { role } = useRole();

  const visibleNav = NAV_BY_ROLE[role] || NAV_BY_ROLE[ROLES.OWNER];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visibleNav.map(({ path, icon: NavIcon, labelKey }) => {
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
  );
}