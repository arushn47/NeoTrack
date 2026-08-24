'use client';

import { useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Mail,
  Shield,
  Calendar,
  Search,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileSpreadsheet,
  Zap,
  BellRing,
  Award,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  no_code: 'Google authentication was cancelled. Please try again.',
  no_email: 'Could not retrieve your email address from Google.',
  db_error: 'Unable to initialize user session in database. Please retry.',
  auth_failed: 'Authentication failed. Please verify your Google account.',
};

export default function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100 relative overflow-hidden flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[550px] h-[550px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[650px] h-[650px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-[#0d0d14] rounded-[10px] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-mono">NeoTrack</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium hidden sm:block">
              Campus Placement Command Center
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 backdrop-blur-md text-xs text-zinc-400 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-zinc-300">2026/2027 Placement Season Live</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 sm:py-8 flex-1 flex items-center">
        <div className="w-full grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Hero & Live Preview Showcase */}
          <div className="lg:col-span-7 space-y-8 animate-fade-in">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Automated NeoPAT & CDC Circular Intelligence</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                Never miss a{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
                  Shortlist, Test, or Interview
                </span>{' '}
                again.
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                NeoTrack connects directly to your personal & college Gmail, automatically extracts test schedules, matches your Neo ID against massive shortlist attachments, and gives you a real-time placement pipeline.
              </p>
            </div>

            {/* Live Interactive Placement Card Simulator */}
            <div className="relative rounded-2xl bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 border border-zinc-800/80 p-5 backdrop-blur-xl shadow-2xl shadow-black/60 space-y-4 group hover:border-indigo-500/30 transition-all duration-300">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Live Intelligence Stream</p>
                    <p className="text-[10px] text-zinc-500">Auto-parsed 2 mins ago from placementoffice@vitbhopal.ac.in</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  SHORTLISTED
                </span>
              </div>

              {/* Company & Details Row */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Company</p>
                  <p className="text-sm font-bold text-white mt-0.5">Microsoft India</p>
                  <p className="text-[11px] text-indigo-400 font-medium">Software Engineer (₹44.5 LPA)</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Next Round</p>
                  <p className="text-sm font-bold text-zinc-200 mt-0.5">Technical Interview</p>
                  <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Tomorrow, 10:00 AM
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Attachment Match</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Neo ID Found
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">Round1_Selected.xlsx</p>
                </div>
              </div>

              {/* Card Footer badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-zinc-400">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Instant Webhooks
                  </span>
                  <span className="flex items-center gap-1 text-zinc-400">
                    <BellRing className="w-3.5 h-3.5 text-cyan-400" />
                    Browser Push Enabled
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  AES-256 Zero-Knowledge
                </span>
              </div>
            </div>

            {/* 3 Quick Value Highlights */}
            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-all">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2.5">
                  <Mail className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-semibold text-zinc-200">Dual Gmail Sync</h2>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Connect personal and college accounts with isolated token encryption.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-all">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2.5">
                  <Search className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-semibold text-zinc-200">Attachment Parser</h2>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Fast multi-sheet Excel & PDF scanning against your registration ID.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-all">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-semibold text-zinc-200">Auto Calendar</h2>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  PPTs, assessments, and interview rounds pinned directly on your calendar.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="relative rounded-3xl bg-gradient-to-b from-zinc-900/90 via-zinc-900/80 to-[#0c0c14]/90 border border-zinc-700/50 p-8 sm:p-9 backdrop-blur-2xl shadow-2xl shadow-indigo-950/40 space-y-6">
              
              {/* Subtle top light bar */}
              <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

              {/* Card Header */}
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Welcome to NeoTrack
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sign in with Google to sync your personal placement circulars and access your live dashboard.
                </p>
              </div>

              {/* Error Alert if any */}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5 animate-fade-in">
                  <span className="text-red-400 font-bold">⚠️</span>
                  <span>{ERROR_MESSAGES[error] || 'An unexpected error occurred. Please try again.'}</span>
                </div>
              )}

              {/* Sign in button */}
              <div className="space-y-4 pt-2">
                <a
                  href="/api/auth/google?type=personal"
                  className="group relative flex items-center justify-center gap-3 w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm shadow-xl shadow-white/5 hover:shadow-indigo-500/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {/* Google G Logo */}
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                </a>

                {/* Steps indicator */}
                <div className="pt-3 border-t border-zinc-800/80 space-y-2 text-[11px] text-zinc-400">
                  <p className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
                    What happens next:
                  </p>
                  <div className="space-y-1.5 pl-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[9px] font-bold">1</span>
                      <span>Primary sign-in with your personal Gmail</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[9px] font-bold">2</span>
                      <span>Link your college (<code className="text-zinc-300">@vitstudent.ac.in</code>) in Settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[9px] font-bold">3</span>
                      <span>Input your Neo ID for automated shortlist detection</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy & Security Trust Badge */}
              <div className="pt-2">
                <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-2.5 text-[11px] text-zinc-400">
                  <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold text-zinc-300">Read-Only Permission</span>: NeoTrack only reads placement-tagged CDC emails. Your credentials are never stored and tokens remain encrypted with AES-256-GCM.
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <p>© 2026 NeoTrack · Engineered for VIT Campus Placements</p>
        <div className="flex items-center gap-4 text-zinc-400">
          <span>End-to-End Encrypted</span>
          <span>·</span>
          <span>Google OAuth 2.0 Verified</span>
          <span>·</span>
          <span>FastAPI Microservice</span>
        </div>
      </footer>
    </div>
  );
}
