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
  PieChart,
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Analytics', href: '/analytics', icon: PieChart },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c14]/95 backdrop-blur-2xl border-t border-zinc-800/90 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl transition-all duration-200 active:scale-95 select-none relative',
                isActive
                  ? 'text-indigo-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300 font-medium'
              )}
            >
              {isActive && (
                <span className="absolute inset-0 bg-indigo-500/15 border border-indigo-500/30 rounded-xl -z-10 animate-fade-in shadow-sm shadow-indigo-500/10" />
              )}
              <item.icon className={cn('w-4 h-4 transition-transform duration-200', isActive && 'scale-110')} />
              <span className="text-[9px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
