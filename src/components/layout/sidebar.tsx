'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Building2,
  CalendarDays,
  PieChart,
  Settings as SettingsIcon,
  Radar,
  Sparkles,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid, exact: true },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: PieChart },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

import { AppLogo, AppLogoMark } from '@/components/brand/logo';
export { AppLogo, AppLogoMark };

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800/80 bg-[#0b0b0e] lg:flex z-40 select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-zinc-800/80 px-5">
        <AppLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-zinc-800/80 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                )}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Campus Live Sync Status Box */}
      <div className="m-3 rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Campus Live Radar
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          Dual Gmail & Excel shortlist scanning active in background.
        </p>
      </div>

      {/* Legal & Support Links */}
      <div className="px-4 pb-3 flex items-center justify-between font-mono text-[10px] text-zinc-600">
        <Link href="/feedback" className="hover:text-zinc-400 transition-colors">
          Feedback
        </Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-zinc-400 transition-colors">
          Privacy
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:text-zinc-400 transition-colors">
          Terms
        </Link>
      </div>
    </aside>
  );
}
