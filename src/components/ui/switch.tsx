'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  name,
  className,
  'aria-label': ariaLabel,
  size = 'md',
}: SwitchProps) {
  const isSm = size === 'sm';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        onCheckedChange(!checked);
      }
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      id={id}
      name={name}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-250 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101014]',
        isSm ? 'h-5 w-9 p-0.5' : 'h-6 w-11 p-0.5',
        checked
          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
          : 'bg-zinc-800/90 border border-zinc-700/60 hover:border-zinc-600',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      <motion.span
        layout
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-sm ring-0',
          isSm ? 'h-4 w-4' : 'h-5 w-5',
          checked
            ? isSm
              ? 'translate-x-4'
              : 'translate-x-5'
            : 'translate-x-0'
        )}
      />
    </button>
  );
}

export default Switch;
