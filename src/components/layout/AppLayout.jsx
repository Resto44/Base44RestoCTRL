import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import NotificationPopups from '@/components/notifications/NotificationPopups.jsx';
import { useAuth } from '@/lib/AuthContext';
import { initAuditLogger } from '@/lib/auditLogger';
import { useRouteGuard } from '@/lib/RoleContext';
import AppHeader from '@/components/layout/AppHeader';
import PWAInstallBanner from '@/components/pwa/PWAInstallBanner';
import QuickActionsDock from '@/components/dashboard/QuickActionsDock';

function RouteEnforcer() {
  useRouteGuard();
  return null;
}

export default function AppLayout() {
  const { user } = useAuth();
  useEffect(() => { if (user) initAuditLogger(user); }, [user]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <RouteEnforcer />
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 pt-4">
        <Outlet />
      </main>
      <QuickActionsDock />
      <BottomNav />
      <NotificationPopups />
      <PWAInstallBanner />
    </div>
  );
}