'use client';

import React from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar,
  Award,
  FileText,
  Building2,
  X,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InAppNotification } from '@/components/notifications/notification-bell';

export type ToastVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'shortlist'
  | 'test'
  | 'interview'
  | 'sync';

export interface ToastAction {
  label: string;
  onClick: () => void;
  url?: string;
}

export interface PremiumToastProps {
  id: string | number;
  variant?: ToastVariant;
  title: string;
  description?: string;
  categoryBadge?: string;
  action?: ToastAction;
  duration?: number;
}

const VARIANT_CONFIGS: Record<
  ToastVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    borderColor: string;
    glowColor: string;
    badgeBg: string;
    badgeText: string;
    defaultBadge: string;
    actionBtnClass: string;
  }
> = {
  shortlist: {
    icon: Sparkles,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/10 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'SHORTLIST MATCH',
    actionBtnClass:
      'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
  test: {
    icon: FileText,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/10 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'TEST SCHEDULED',
    actionBtnClass:
      'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
  interview: {
    icon: Award,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/10 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'INTERVIEW ROUND',
    actionBtnClass:
      'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/10 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'SUCCESS',
    actionBtnClass:
      'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-rose-500/10 border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    glowColor: 'from-rose-500/10 via-transparent to-transparent',
    badgeBg: 'bg-rose-500/10 border border-rose-500/25',
    badgeText: 'text-rose-400',
    defaultBadge: 'ERROR',
    actionBtnClass: 'bg-rose-500 hover:bg-rose-400 text-white font-semibold',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/8 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'NOTICE',
    actionBtnClass: 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold',
  },
  info: {
    icon: Info,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/8 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'INFO',
    actionBtnClass: 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold',
  },
  sync: {
    icon: Zap,
    iconBg: 'bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    glowColor: 'from-emerald-500/10 via-transparent to-transparent',
    badgeBg: 'bg-emerald-500/10 border border-emerald-500/25',
    badgeText: 'text-emerald-300',
    defaultBadge: 'RADAR SYNC',
    actionBtnClass:
      'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.25)]',
  },
};

/**
 * PremiumToast Component
 * Obsidian glass chassis, glowing micro-accent, custom badge, and responsive actions.
 */
export function PremiumToast({
  id,
  variant = 'info',
  title,
  description,
  categoryBadge,
  action,
}: PremiumToastProps) {
  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.info;
  const Icon = config.icon;

  return (
    <div
      data-premium-toast=""
      className={cn(
        'relative w-full max-w-[370px] overflow-hidden rounded-xl border px-3.5 py-2.5 shadow-xl transition-all duration-300',
        'bg-[#0d0d11]/95 backdrop-blur-2xl',
        config.borderColor
      )}
    >
      {/* Subtle ambient radial glow in corner */}
      <div
        className={cn(
          'pointer-events-none absolute -top-8 -left-8 h-24 w-24 rounded-full bg-gradient-to-br blur-xl opacity-80',
          config.glowColor
        )}
      />

      <div className="relative flex items-center gap-2.5">
        {/* Compact Type Icon Square */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
            config.iconBg,
            config.iconColor
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {categoryBadge && (
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[8px] font-bold tracking-wider uppercase shrink-0',
                  config.badgeBg,
                  config.badgeText
                )}
              >
                {categoryBadge}
              </span>
            )}
            <h4 className="font-display text-xs font-semibold text-white tracking-tight truncate">
              {title}
            </h4>
          </div>

          {description && (
            <p className="text-[11px] text-zinc-400 truncate mt-0.5 leading-tight">
              {description}
            </p>
          )}
        </div>

        {/* Action Button */}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              toast.dismiss(id);
            }}
            className={cn(
              'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-transform active:scale-95 cursor-pointer',
              config.actionBtnClass
            )}
          >
            <span>{action.label}</span>
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        )}

        {/* Dismiss Cross */}
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Public Toast API (appToast)
// ============================================

export const appToast = {
  /**
   * Shortlist cracked alert (Emerald aura, sparkles, high impact)
   */
  shortlist: (
    title: string,
    options?: {
      description?: string;
      company?: string;
      action?: ToastAction;
      duration?: number;
    }
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="shortlist"
          title={title}
          description={options?.description}
          categoryBadge={options?.company ? `${options.company} · SHORTLIST` : undefined}
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? Infinity }
    );
  },

  /**
   * OA / Assessment / Test scheduled alert (Amber aura, test sheet)
   */
  test: (
    title: string,
    options?: {
      description?: string;
      company?: string;
      action?: ToastAction;
      duration?: number;
    }
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="test"
          title={title}
          description={options?.description}
          categoryBadge={options?.company ? `${options.company} · TEST ROUND` : undefined}
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? Infinity }
    );
  },

  /**
   * Interview round alert (Purple aura)
   */
  interview: (
    title: string,
    options?: {
      description?: string;
      company?: string;
      action?: ToastAction;
      duration?: number;
    }
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="interview"
          title={title}
          description={options?.description}
          categoryBadge={options?.company ? `${options.company} · INTERVIEW` : undefined}
          action={options?.action}
        />
      ),
      { duration: options?.duration ?? Infinity }
    );
  },

  /**
   * Success notification
   */
  success: (
    title: string,
    description?: string,
    action?: ToastAction,
    duration = Infinity
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="success"
          title={title}
          description={description}
          action={action}
        />
      ),
      { duration }
    );
  },

  /**
   * Error notification
   */
  error: (
    title: string,
    description?: string,
    action?: ToastAction,
    duration = Infinity
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="error"
          title={title}
          description={description}
          action={action}
        />
      ),
      { duration }
    );
  },

  /**
   * Warning notification
   */
  warning: (
    title: string,
    description?: string,
    action?: ToastAction,
    duration = Infinity
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="warning"
          title={title}
          description={description}
          action={action}
        />
      ),
      { duration }
    );
  },

  /**
   * General info notification
   */
  info: (
    title: string,
    description?: string,
    action?: ToastAction,
    duration = Infinity
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="info"
          title={title}
          description={description}
          action={action}
        />
      ),
      { duration }
    );
  },

  /**
   * Sync complete or background radar update
   */
  sync: (
    title: string,
    description?: string,
    action?: ToastAction,
    duration = Infinity
  ) => {
    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant="sync"
          title={title}
          description={description}
          action={action}
        />
      ),
      { duration }
    );
  },

  /**
   * Dynamically formats any InAppNotification into the right premium toast variant!
   */
  notification: (
    notif: InAppNotification,
    routerNavigate?: (url: string) => void
  ) => {
    let variant: ToastVariant = 'info';
    let badge: string | undefined;

    switch (notif.type) {
      case 'shortlist_match':
        variant = 'shortlist';
        badge = 'SHORTLIST MATCH';
        break;
      case 'test_scheduled':
        variant = 'test';
        badge = 'TEST SCHEDULED';
        break;
      case 'interview_scheduled':
        variant = 'interview';
        badge = 'INTERVIEW';
        break;
      case 'ppt_scheduled':
        variant = 'info';
        badge = 'PPT SESSION';
        break;
      case 'new_company':
        variant = 'sync';
        badge = 'NEW DRIVE';
        break;
      case 'status_change':
        variant = 'success';
        badge = 'STAGE UPDATE';
        break;
      default:
        variant = 'info';
        badge = 'ALERT';
    }

    const actionUrl = notif.link || (notif.company_id ? `/companies/${notif.company_id}` : undefined);
    const action: ToastAction | undefined =
      actionUrl && routerNavigate
        ? {
            label: 'View Details',
            onClick: () => routerNavigate(actionUrl),
          }
        : undefined;

    return toast.custom(
      (id) => (
        <PremiumToast
          id={id}
          variant={variant}
          title={notif.title}
          description={notif.body || notif.message}
          categoryBadge={badge}
          action={action}
        />
      ),
      { duration: Infinity }
    );
  },
};
