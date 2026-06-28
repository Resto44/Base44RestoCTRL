import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/lib/LanguageContext';

export default function LogoutButton({ variant = 'icon' }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { lang } = useLanguage();

  const labels = {
    en: { confirm: 'Logout', cancel: 'Cancel', title: 'Log out of your account?', body: 'All local data will be cleared.' },
    ar: { confirm: 'تسجيل الخروج', cancel: 'إلغاء', title: 'تسجيل الخروج من حسابك؟', body: 'سيتم مسح جميع البيانات المحلية.' },
    fa: { confirm: 'خروج', cancel: 'لغو', title: 'از حساب خود خارج شوید؟', body: 'تمام داده‌های محلی پاک می‌شوند.' },
  };
  const L = labels[lang] || labels.en;

  const handleLogout = async () => {
    // 1. Clear all React Query cache
    queryClient.removeQueries();
    queryClient.clear();

    // 2. Clear all storage
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}

    // 3. Logout via AuthContext (redirects to /auth via navigate)
    logout();
  };

  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {L.confirm}
        </button>
        <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={handleLogout} L={L} />
      </>
    );
  }

  // Default: icon button
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
        title={L.confirm}
      >
        <LogOut className="w-4 h-4" />
      </button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={handleLogout} L={L} />
    </>
  );
}

function ConfirmDialog({ open, onClose, onConfirm, L }) {
  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{L.title}</AlertDialogTitle>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground px-1">{L.body}</p>
        <AlertDialogFooter>
          <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
            {L.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}