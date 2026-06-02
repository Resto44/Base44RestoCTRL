import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, MoreHorizontal, Wallet, Users, Truck, Home } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole, ROLES } from '@/lib/RoleContext';

// Clean enterprise navigation — 5 items max per role
const NAV_BY_ROLE = {
  [ROLES.OWNER]: [
    { path: '/',          icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',     icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',  icon: Truck,           labelKey: 'delivery' },
    { path: '/treasury',  icon: Wallet,          labelKey: 'treasury' },
    { path: '/settings',  icon: MoreHorizontal,  labelKey: 'settings' },
  ],
  [ROLES.RESTAURANT_ADMIN]: [
    { path: '/',          icon: LayoutDashboard, labelKey: 'dashboard' },
    { path: '/sales',     icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',  icon: Truck,           labelKey: 'delivery' },
    { path: '/reports',   icon: BarChart3,       labelKey: 'reports' },
    { path: '/settings',  icon: MoreHorizontal,  labelKey: 'settings' },
  ],
  [ROLES.MANAGER]: [
    { path: '/sales',               icon: Receipt,         labelKey: 'sales' },
    { path: '/delivery',            icon: Truck,           labelKey: 'delivery' },
    { path: '/employee-attendance', icon: Users,           labelKey: 'attendance' },
    { path: '/settings',            icon: MoreHorizontal,  labelKey: 'settings' },
  ],
  [ROLES.STAFF]: [
    { path: '/staff-upload',        icon: Receipt,         labelKey: 'sales' },
    { path: '/employee-attendance', icon: Users,           labelKey: 'attendance' },
  ],
  [ROLES.SPONSOR]: [
    { path: '/sponsor-treasury', icon: Wallet, labelKey: 'treasury' },
  ],
  [ROLES.DRIVER]: [
    { path: '/driver', icon: Home, labelKey: 'home' },
  ],
  [ROLES.EMPLOYEE]: [
    { path: '/employee', icon: Home, labelKey: 'home' },
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