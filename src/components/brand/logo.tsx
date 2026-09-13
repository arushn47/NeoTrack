import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface AppLogoMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

/**
 * AppLogoMark — The Apex Radar Logomark
 * 
 * Features:
 * - Deep obsidian squircle with specular emerald rim
 * - High-precision radar telemetry scope with cardinal notches
 * - Aerodynamic chiseled "W" vector wings
 * - Pure white / cyan ascending telemetry chevron
 * - 4-point glowing Offer Beacon star
 */
export const AppLogoMark: React.FC<AppLogoMarkProps> = ({
  size = 32,
  className,
  animated = false,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn('shrink-0 select-none overflow-visible', className)}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Background Radial Void */}
        <radialGradient id="markBgGrad" cx="50%" cy="36%" r="72%">
          <stop offset="0%" stopColor="#0e291e" />
          <stop offset="48%" stopColor="#090e13" />
          <stop offset="100%" stopColor="#020305" />
        </radialGradient>

        {/* Specular Rim Gradient */}
        <linearGradient id="markRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.9" />
          <stop offset="28%" stopColor="#10b981" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#047857" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>

        {/* Emerald Left Wing Gradient */}
        <linearGradient id="markWingLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="35%" stopColor="#2dd4bf" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Emerald Right Wing Gradient */}
        <linearGradient id="markWingRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="35%" stopColor="#34d399" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#065f46" />
        </linearGradient>

        {/* Center Bridge Gradient */}
        <linearGradient id="markBridge" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        {/* Radar Sweep Gradient */}
        <linearGradient id="markSweep" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="80%" stopColor="#10b981" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.32" />
        </linearGradient>

        {/* Specular Inlay Glow */}
        <filter id="markBloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="markBeaconBloom" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="tight" />
          <feGaussianBlur stdDeviation="20" result="wide" />
          <feMerge>
            <feMergeNode in="wide" />
            <feMergeNode in="tight" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Squircle Container */}
      <rect x="10" y="10" width="492" height="492" rx="124" fill="url(#markBgGrad)" />
      <rect x="10" y="10" width="492" height="492" rx="124" fill="none" stroke="url(#markRimGrad)" strokeWidth="2.5" />

      {/* Radar Telemetry Grid */}
      <g opacity="0.65">
        <circle cx="256" cy="256" r="192" fill="none" stroke="#10b981" strokeWidth="1.8" strokeDasharray="6 8" strokeOpacity="0.3" />
        <circle cx="256" cy="256" r="132" fill="none" stroke="#10b981" strokeWidth="1.4" strokeOpacity="0.22" />
        <circle cx="256" cy="256" r="74" fill="none" stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 6" strokeOpacity="0.2" />

        {/* Radar Sweep Sector */}
        <path d="M 256 256 L 416 148 A 192 192 0 0 0 316 70 Z" fill="url(#markSweep)" />
        <line x1="256" y1="256" x2="416" y2="148" stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.85" />

        {/* Cardinal Ticks */}
        <line x1="256" y1="46" x2="256" y2="70" stroke="#34d399" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.8" />
        <line x1="256" y1="442" x2="256" y2="466" stroke="#34d399" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.8" />
        <line x1="46" y1="256" x2="70" y2="256" stroke="#34d399" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.8" />
        <line x1="442" y1="256" x2="466" y2="256" stroke="#34d399" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.8" />

        {/* Telemetry Points */}
        <circle cx="392" cy="120" r="3.5" fill="#5eead4" opacity="0.75" />
        <circle cx="120" cy="392" r="2.5" fill="#34d399" opacity="0.4" />
        <circle cx="392" cy="392" r="2.5" fill="#34d399" opacity="0.4" />
        <circle cx="120" cy="120" r="3.5" fill="#5eead4" opacity="0.75" />
      </g>

      {/* Ambient Underglow */}
      <circle cx="256" cy="272" r="115" fill="#10b981" fillOpacity="0.16" filter="url(#markBloom)" />

      {/* The W Vector Glyph */}
      <g filter="url(#markBloom)">
        {/* Left Wing */}
        <path d="M 124 186 L 168 186 L 218 344 L 182 360 Z" fill="url(#markWingLeft)" />
        {/* Center-Left Connector */}
        <path d="M 182 360 L 218 344 L 256 250 L 242 232 Z" fill="url(#markBridge)" />
        {/* Center-Right Connector */}
        <path d="M 270 232 L 256 250 L 294 344 L 330 360 Z" fill="url(#markBridge)" />
        {/* Right Wing */}
        <path d="M 388 186 L 344 186 L 294 344 L 330 360 Z" fill="url(#markWingRight)" />

        {/* Ascending Pure White / Cyan Chevron */}
        <path d="M 184 290 L 208 290 L 256 202 L 304 290 L 328 290 L 256 168 Z" fill="#ffffff" opacity="0.96" />
      </g>

      {/* The Offer Beacon Star */}
      <g transform="translate(256, 128)" filter="url(#markBeaconBloom)">
        <circle cx="0" cy="0" r="28" fill="none" stroke="#6ee7b7" strokeWidth="1.8" strokeDasharray="5 4" strokeOpacity="0.85" />
        <circle cx="0" cy="0" r="16" fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeOpacity="0.5" />
        <path d="M 0 -26 C 0 -8, 8 0, 26 0 C 8 0, 0 8, 0 26 C 0 8, -8 0, -26 0 C -8 0, 0 -8, 0 -26 Z" fill="#ffffff" />
        <circle cx="0" cy="0" r="5" fill="#34d399" />
      </g>
    </svg>
  );
};

export interface AppLogoProps {
  href?: string;
  className?: string;
  showSubtitle?: boolean;
  size?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  href = '/',
  className,
  showSubtitle = true,
  size = 32,
}) => {
  const content = (
    <div className={cn('flex items-center gap-2.5 group select-none', className)}>
      <div className="relative shrink-0 transition-transform duration-200 group-hover:scale-105 group-hover:drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]">
        <AppLogoMark size={size} />
      </div>
      <div className="leading-none min-w-0">
        <div className="font-display text-sm font-bold tracking-tight text-zinc-100 truncate group-hover:text-white transition-colors">
          Where&apos;s My Offer<span className="text-emerald-400 font-extrabold ml-0.5 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]">?</span>
        </div>
        {showSubtitle && (
          <div className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-widest text-zinc-500 sm:block group-hover:text-zinc-400 transition-colors">
            placement radar · live
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
};

export default AppLogo;
