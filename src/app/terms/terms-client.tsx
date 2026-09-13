'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowLeft,
  ArrowUp,
  Mail,
  ExternalLink,
  Scale,
  Radar,
  XCircle,
} from 'lucide-react';
import { AppLogoMark } from '@/components/brand/logo';

const LAST_UPDATED = 'September 12, 2026';
const APP_NAME = "Where's My Offer?";
const APP_URL = 'https://wheresmyoffer.vercel.app';

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('opacity-100', 'translate-y-0');
          el.classList.remove('opacity-0', 'translate-y-6');
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className="opacity-0 translate-y-6 transition-all duration-700 ease-out"
    >
      {children}
    </div>
  );
}

export default function TermsClient() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 selection:bg-emerald-500/20 font-sans overflow-x-hidden">
      {/* Animated Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-violet-500/[0.06] blur-[120px] animate-pulse" />
        <div className="absolute -bottom-32 -left-32 h-[600px] w-[600px] rounded-full bg-emerald-500/[0.05] blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-teal-500/[0.03] blur-[100px]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(16,185,129,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <AppLogoMark size={36} className="transition-transform group-hover:scale-105" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-white text-sm sm:text-base tracking-tight">
                  {APP_NAME}
                </span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
                  LEGAL
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500">Placement Radar · Live</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
              <Link
                href="/privacy"
                className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-zinc-400 hover:text-white rounded-md transition-colors"
              >
                Privacy
              </Link>
              <span className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-white bg-zinc-800 rounded-md shadow-sm">
                Terms
              </span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to App</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero Header */}
        <AnimatedSection>
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400 mb-5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              BINDING AGREEMENT · VIT STUDENT PLATFORM
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-5 font-display leading-tight">
              Terms of{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Service
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 mb-7">
              <span>
                Last updated: <span className="text-zinc-200 font-semibold">{LAST_UPDATED}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>App: {APP_NAME}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-emerald-400">Status: Active & Enforced</span>
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-[#101014]/80 backdrop-blur-sm p-5 text-sm leading-relaxed text-zinc-300 shadow-xl shadow-black/40">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of{' '}
              <strong className="text-white">{APP_NAME}</strong> (
              <a
                href={APP_URL}
                className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 font-mono text-xs transition-colors"
              >
                {APP_URL}
              </a>
              ), an automated campus placement intelligence and application tracking platform built for VIT students. By signing in or accessing the service, you agree to be bound by these Terms.
            </div>
          </div>
        </AnimatedSection>

        {/* Legal Sections */}
        <div className="space-y-5">
          {/* 1. Acceptance */}
          <AnimatedSection delay={50}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">01</span>
                <h2 className="text-lg font-bold text-white">Acceptance of Terms & Eligibility</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                By accessing or using {APP_NAME}, you confirm that you are at least 13 years old, a current or prospective student of VIT Bhopal University (or affiliated VIT campuses), and that you agree to be bound by these Terms and our{' '}
                <Link href="/privacy" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-colors">
                  Privacy Policy
                </Link>
                . If you do not agree to these Terms, you must discontinue using the platform immediately.
              </p>
            </section>
          </AnimatedSection>

          {/* 2. Description of Service */}
          <AnimatedSection delay={80}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">02</span>
                <h2 className="text-lg font-bold text-white">Description of Service & Scope</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                {APP_NAME} is a personal productivity platform designed to help candidates track campus placement recruitment drives, online tests, interviews, and offer letters. Core automated services include:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  { title: 'Email Parsing', desc: 'Reads official placement updates from CDC and NeoPAT dispatch addresses.' },
                  { title: 'Drive Indexing', desc: 'Categorizes company profiles, salary packages, CTC tiers, and deadlines.' },
                  { title: 'Shortlist Scanning', desc: 'Parses Excel/PDF attachments to verify your candidate registration ID.' },
                  { title: 'Calendar Sync', desc: 'Optionally creates synchronized Google Calendar events for tests and interviews.' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200">{feature.title}</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-zinc-500 font-mono">
                {APP_NAME} is provided &quot;as is&quot; as a personal productivity service. We make no representations or warranties regarding third-party college portal uptime.
              </p>
            </section>
          </AnimatedSection>

          {/* 3. Google Account & Permissions */}
          <AnimatedSection delay={100}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">03</span>
                <h2 className="text-lg font-bold text-white">Google Account Access & OAuth Scopes</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                {APP_NAME} interfaces with Google APIs to retrieve your placement communications. When connecting, you authorize access under the following explicit OAuth scopes:
              </p>

              <div className="space-y-2.5 mb-4">
                {[
                  {
                    name: 'gmail.readonly',
                    purpose: 'Restricted read-only access to identify placement emails from official CDC/NeoPAT senders. Never modifies or sends emails.',
                  },
                  {
                    name: 'calendar.events',
                    purpose: 'Optional scope used strictly to create, update, and manage placement assessment and interview calendar events.',
                  },
                  {
                    name: 'userinfo.profile',
                    purpose: 'Basic profile identifiers used to authenticate your session and render candidate details.',
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">OAuth 2.0</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.purpose}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                You may revoke permissions at any time via{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 inline-flex items-center gap-1 font-mono text-[11px] transition-colors"
                >
                  myaccount.google.com/permissions <ExternalLink className="h-3 w-3 inline" />
                </a>
                . Revoking tokens halts synchronization but retains existing indexed data until you request deletion via Settings.
              </p>
            </section>
          </AnimatedSection>

          {/* 4. Acceptable Use */}
          <AnimatedSection delay={120}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">04</span>
                <h2 className="text-lg font-bold text-white">Acceptable Use Policy</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-3">
                You agree to use {APP_NAME} solely for legitimate personal placement tracking. You shall not:
              </p>

              <ul className="space-y-2">
                {[
                  'Use the service for any unlawful purpose or in violation of institutional university policies.',
                  'Share your authenticated session credentials or create accounts on behalf of unauthorized third parties.',
                  'Attempt to probe, reverse-engineer, exploit, or disrupt API endpoints or background sync services.',
                  'Scrape, harvest, or aggregate candidate information belonging to other students.',
                  'Circumvent rate limits, caching mechanisms, or security controls enforced on the platform.',
                ].map((prohibition, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-400 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 hover:border-zinc-700/60 transition-colors">
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{prohibition}</span>
                  </li>
                ))}
              </ul>
            </section>
          </AnimatedSection>

          {/* 5. Data Accuracy Disclaimer */}
          <AnimatedSection delay={140}>
            <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#141210]/80 to-[#0f0e0a]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-amber-500/35 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Data Accuracy & Verification Disclaimer</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300 mb-3">
                {APP_NAME} leverages automated regex parsing and heuristic extraction to parse email communications and shortlist attachments. While engineered for maximum precision,{' '}
                <strong className="text-white">you must always verify mission-critical details directly with official CDC circulars and company emails.</strong>
              </p>
              <p className="text-xs leading-relaxed text-amber-300/80 font-mono">
                Do not rely solely on automated calendar notifications or drive statuses for final test links, reporting venues, or interview slots. {APP_NAME} is an auxiliary companion tool.
              </p>
            </section>
          </AnimatedSection>

          {/* 6. Service Availability */}
          <AnimatedSection delay={155}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">06</span>
                <h2 className="text-lg font-bold text-white">Service Availability & Revisions</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-3">
                As an evolving student productivity system, {APP_NAME} does not guarantee 100% uninterrupted uptime. We reserve the right to:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-400">
                {[
                  'Update or deprecate features based on academic recruitment seasons.',
                  'Perform background index optimizations and cron synchronization adjustments.',
                  'Revise these Terms to reflect compliance or architectural updates.',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 hover:border-zinc-700/60 transition-colors">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </AnimatedSection>

          {/* 7. Limitation of Liability */}
          <AnimatedSection delay={165}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <Scale className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Limitation of Liability</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                To the fullest extent permitted by applicable law, {APP_NAME} and its authors shall not be held liable for any indirect, incidental, punitive, or consequential damages resulting from your use of (or inability to use) the service, including missed assessment windows, lost opportunity costs, or third-party email delivery delays. The platform is provided strictly{' '}
                <strong className="text-zinc-200">&quot;as is&quot; without warranty of any kind</strong>.
              </p>
            </section>
          </AnimatedSection>

          {/* 8. Termination */}
          <AnimatedSection delay={175}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <Lock className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Termination & Data Erasure</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-3">
                You retain complete sovereignty over your data. You may terminate your account and wipe all stored application records, sync states, and cached tokens at any moment directly via:
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 flex items-center justify-between hover:border-zinc-700/60 transition-colors">
                <span className="font-mono text-xs text-zinc-300">Dashboard → Settings → Danger Zone</span>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Go to Settings →
                </Link>
              </div>
            </section>
          </AnimatedSection>

          {/* 9. Contact & Support */}
          <AnimatedSection delay={185}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <Mail className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Contact & Support Desk</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                For legal inquiries, clarification on these Terms, or technical support requests, please submit a ticket via our Feedback & Support Desk:
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">{APP_NAME} Engineering & Compliance</p>
                  <p className="text-[11px] text-zinc-500 font-mono">VIT Bhopal University · Student Project</p>
                </div>
                <Link
                  href="/feedback"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <span>Submit Inquiry or Feedback →</span>
                </Link>
              </div>
            </section>
          </AnimatedSection>
        </div>

        {/* Footer */}
        <AnimatedSection delay={200}>
          <div className="mt-16 pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
            <div className="flex items-center justify-center gap-3 sm:gap-4 whitespace-nowrap text-[11px]">
              <Link href="/privacy" className="hover:text-zinc-200 transition-colors whitespace-nowrap">
                Privacy Policy
              </Link>
              <span className="text-zinc-700">·</span>
              <Link href="/feedback" className="hover:text-zinc-200 transition-colors whitespace-nowrap">
                Feedback & Support
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </main>

      {/* Hovering / Floating Scroll to Top Arrow Button */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        title="Scroll to top"
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/90 text-zinc-300 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white active:scale-95 cursor-pointer ${
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
