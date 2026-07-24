'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';
import { LogoMark } from '@/app/components/ui';
import { useAuth } from '@/lib/auth-context';
import {
  Home,
  Users,
  TrendingUp,
  UserPlus,
  FlaskConical,
  Globe,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: Home },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Users },
  { name: 'Sales', href: '/dashboard/sales', icon: TrendingUp },
  { name: 'Traffic', href: '/dashboard/traffic', icon: Globe },
  { name: 'Leads (CRM)', href: '/dashboard/leads', icon: UserPlus },
  { name: 'Dry Test', href: '/dashboard/funnel', icon: FlaskConical },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ item }: { item: typeof navigation[number] }) => {
    const isActive =
      item.href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
          isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
      >
        <item.icon className="w-5 h-5" />
        {item.name}
      </Link>
    );
  };

  const Content = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <LogoMark className="text-primary-600" />
          <div>
            <h1 className="text-[13px] font-bold tracking-[2.5px] text-primary-600">ONEORAL</h1>
            <p className="text-xs text-slate-500">Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Main</p>
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink key={item.name} item={item} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-slate-700 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6" />
      </button>
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2"
        >
          <X className="w-6 h-6" />
        </button>
        <Content />
      </aside>
    </>
  );
}
