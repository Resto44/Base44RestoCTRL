import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useRole, ROLES } from '@/lib/RoleContext';
import LogoutButton from '@/components/layout/LogoutButton';
import {
  Globe, Moon, DollarSign, Package, Wallet, Bell, Boxes,
  Building2, CreditCard, ChefHat, Users, CalendarCheck, Landmark,
  Smartphone, BarChart, GitBranch, UtensilsCrossed, Shield,
  Truck, FileText, History, ArrowLeftRight, Flame, CheckSquare,
  BarChart2, TrendingUp, ShieldCheck, Clock, Send, BarChart3, BookOpen, Receipt
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Operations',
    roles: [ROLES.OWNER, ROLES.MANAGER],
    links: [
      { path: '/sales',              icon: DollarSign,   label: 'Daily Sales' },
      { path: '/purchases',          icon: Receipt,      label: 'Purchases' },
      { path: '/procurement-dashboard', icon: BarChart3,   label: 'Procurement Analytics' },
      { path: '/supplier-ledger',      icon: BookOpen,     label: 'Supplier Ledger' },
      { path: '/expenses',           icon: Wallet,       label: 'Expenses' },
      { path: '/delivery',           icon: Truck,        label: 'Delivery' },
      { path: '/driver-settlements', icon: CheckSquare,  label: 'Settlements' },
      { path: '/menu-products',      icon: ChefHat,      label: 'Menu Products' },
    ],
  },
  {
    title: 'Inventory',
    roles: [ROLES.OWNER, ROLES.MANAGER],
    links: [
      { path: '/inventory',           icon: Boxes,       label: 'Inventory' },
      { path: '/inventory-transfers', icon: ArrowLeftRight, label: 'Transfers' },
      { path: '/inventory-waste',     icon: Flame,       label: 'Waste Log' },
      { path: '/purchase-orders',     icon: FileText,    label: 'Purchase Orders' },
      { path: '/products',            icon: Package,     label: 'Products Catalog' },
      { path: '/recipes',             icon: ChefHat,     label: 'Recipes / BOM' },
    ],
  },
  {
    title: 'People',
    roles: [ROLES.OWNER],
    links: [
      { path: '/employees',           icon: Users,       label: 'Employees' },
      { path: '/employee-attendance', icon: Clock,       label: 'Attendance' },
      { path: '/employee-control',    icon: Shield,      label: 'Employee Control' },
      { path: '/payroll',             icon: CalendarCheck, label: 'Payroll' },
    ],
  },
  {
    title: 'Finance',
    roles: [ROLES.OWNER],
    links: [
      { path: '/treasury',            icon: Landmark,    label: 'Treasury' },
      { path: '/debts',               icon: CreditCard,  label: 'Debt Management' },
      { path: '/network-accounts',    icon: Smartphone,  label: 'Network Accounts' },
      { path: '/network-analytics',   icon: BarChart,    label: 'Network Analytics' },
      { path: '/sponsor-treasury',    icon: ShieldCheck, label: 'Sponsor Treasury' },
    ],
  },
  {
    title: 'Analytics & Reports',
    roles: [ROLES.OWNER],
    links: [
      { path: '/reports',             icon: BarChart2,   label: 'Reports' },
      { path: '/profit-loss',         icon: TrendingUp,  label: 'Profit & Loss' },
      { path: '/cashflow',            icon: Wallet,      label: 'Cash Flow' },
      { path: '/sales-dashboard',     icon: BarChart2,   label: 'Sales Dashboard' },
      { path: '/activity-logs',       icon: History,     label: 'Activity Logs' },
    ],
  },
  {
    title: 'Configuration',
    roles: [ROLES.OWNER],
    links: [
      { path: '/restaurants',         icon: UtensilsCrossed, label: 'Restaurants' },
      { path: '/branch-management',   icon: GitBranch,   label: 'Branches' },
      { path: '/brand',               icon: Building2,   label: 'Brand & Settings' },
      { path: '/categories',          icon: Package,     label: 'Categories' },
      { path: '/approval-policy',     icon: Shield,      label: 'Approval Policy' },
      { path: '/billing',             icon: CreditCard,  label: 'Billing' },
      { path: '/notifications',       icon: Bell,        label: 'Notifications' },
      { path: '/support',             icon: Bell,        label: 'Support' },
      { path: '/telegram-settings',    icon: Send,        label: 'Telegram Notifications' },
    ],
  },
];

export default function SettingsPage() {
  const { t, lang, setLang, currency, setCurrency, darkMode, setDarkMode } = useLanguage();
  const { role } = useRole();

  const visibleSections = SECTIONS.filter(s => s.roles.includes(role));

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold">Settings</h1>
        <Badge variant="outline" className="capitalize text-xs">{role}</Badge>
      </div>

      {/* Preferences */}
      <Card className="p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preferences</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">{t('language')}</Label>
          </div>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="fa">فارسی</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">{t('currency_symbol')}</Label>
          </div>
          <div className="flex gap-1">
            {['SAR', '$', '€'].map(sym => (
              <button key={sym} onClick={() => setCurrency(sym)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${currency === sym ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
                {sym}
              </button>
            ))}
            <Input value={currency} onChange={e => setCurrency(e.target.value)} className="w-16 h-7 text-xs" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">{t('dark_mode')}</Label>
          </div>
          <Switch checked={darkMode} onCheckedChange={setDarkMode} />
        </div>
      </Card>

      {/* Role-based sections */}
      {visibleSections.map(section => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{section.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            {section.links.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path}
                className="flex items-center gap-2.5 px-3 py-3 bg-card border border-border rounded-xl hover:bg-accent/10 transition-colors active:scale-95">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <Card className="p-1 border-red-200">
        <LogoutButton variant="menu-item" />
      </Card>
    </div>
  );
}