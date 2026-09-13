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
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutGrid, exact: true },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Analytics', href: '/analytics', icon: PieChart },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-zinc-800/80 bg-[#0b0b0e]/95 backdrop-blur-xl safe-area-pb">
      <div className="flex items-center justify-around w-full h-14 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors select-none',
                isActive ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <item.icon className={cn('h-4 w-4 transition-transform', isActive && 'scale-110 text-emerald-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
