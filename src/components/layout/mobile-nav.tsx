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
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-surface/90 backdrop-blur-2xl border-t border-border-default/80 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] safe-area-pb">
      <div className="flex items-center justify-around h-16 px-3 max-w-md mx-auto">
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
                'flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-95 select-none relative',
                isActive
                  ? 'text-accent font-semibold'
                  : 'text-text-tertiary hover:text-text-secondary font-medium'
              )}
            >
              {isActive && (
                <span className="absolute inset-0 bg-accent/10 border border-accent/25 rounded-2xl -z-10 animate-fade-in" />
              )}
              <item.icon className={cn('w-5 h-5 transition-transform duration-200', isActive && 'scale-110')} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
