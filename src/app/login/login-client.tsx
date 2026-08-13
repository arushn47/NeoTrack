'use client';

import { useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Mail,
  Shield,
  BarChart3,
  Calendar,
  Search,
} from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  no_code: 'Authentication was cancelled.',
  no_email: 'Could not retrieve your email address.',
  db_error: 'Database error — please try again.',
  auth_failed: 'Authentication failed — please try again.',
};

const features = [
  {
    icon: Mail,
    title: 'Gmail Integration',
    desc: 'Connect personal & college Gmail to pull all placement updates automatically.',
  },
  {
    icon: BarChart3,
    title: 'Smart Dashboard',
    desc: 'See your entire placement journey — statuses, shortlists, and next steps at a glance.',
  },
  {
    icon: Search,
    title: 'Neo ID Matching',
    desc: 'Automatically find your name in candidate shortlists from XLSX/PDF attachments.',
  },
  {
    icon: Calendar,
    title: 'Event Calendar',
    desc: 'Never miss a PPT, test, or interview — all schedules extracted and organized.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    desc: 'Your data stays encrypted. Gmail tokens are AES-256 protected. No third-party sharing.',
  },
  {
    icon: Briefcase,
    title: 'Manual Overrides',
    desc: 'AI got it wrong? Edit any status, company, or event and it stays overridden.',
  },
];

export default function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/8 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-500/6 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo & Title */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-6">
            <Briefcase className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            NeoTrack
          </h1>
          <p className="text-text-secondary text-base">
            Your campus placement command center
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm animate-fade-in">
            {ERROR_MESSAGES[error] || 'An unknown error occurred.'}
          </div>
        )}

        {/* Sign in card */}
        <div className="glass-card rounded-2xl p-8 mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Get Started
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Sign in with your Google account to connect your Gmail and start tracking.
          </p>

          <a
            href="/api/auth/google?type=personal"
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </a>

          <p className="text-text-tertiary text-xs text-center mt-4">
            We only request read-only access to your Gmail.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-3 stagger-children">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="p-4 rounded-xl bg-bg-surface border border-border-default hover:border-border-subtle hover:bg-bg-surface-hover transition-all group"
            >
              <feat.icon className="w-5 h-5 text-accent mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-sm font-medium text-text-primary mb-1">
                {feat.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-text-tertiary text-xs mt-8">
          Built for VIT campus placements · Your data never leaves your control
        </p>
      </div>
    </div>
  );
}
