'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Analytics', href: '/analytics', icon: PieChart },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen bg-[#0a0a10]/95 backdrop-blur-2xl border-r border-zinc-800/80 transition-all duration-300 sticky top-0 z-40 selection:bg-indigo-500/20',
        collapsed ? 'w-[72px]' : 'w-[248px]'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800/80">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0d0d16] rounded-[10px] flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white font-bold text-sm font-mono tracking-tight">
                NeoTrack
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                PRO
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group duration-200',
                isActive
                  ? 'bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 shadow-sm shadow-indigo-400" />
              )}
              <item.icon
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 duration-200',
                  isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Pro Badge & Collapse Toggle */}
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        {!collapsed && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800 text-[11px] space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Campus Live Sync</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              CDC & NeoPAT circulars parsing active.
            </p>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all text-xs font-medium"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px]">Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
