'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Database,
  KeyRound,
  ExternalLink,
  ArrowLeft,
  ArrowUp,
  Mail,
  EyeOff,
  Server,
  Radar,
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

export default function PrivacyClient() {
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
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.06] blur-[120px] animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full bg-violet-500/[0.05] blur-[140px]" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
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
                  PRIVACY
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500">Placement Radar · Live</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
              <span className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-white bg-zinc-800 rounded-md shadow-sm">
                Privacy
              </span>
              <Link
                href="/terms"
                className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-zinc-400 hover:text-white rounded-md transition-colors"
              >
                Terms
              </Link>
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
              DATA PROTECTION · GOOGLE LIMITED USE COMPLIANT
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-5 font-display leading-tight">
              Privacy{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Policy
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 mb-7">
              <span>
                Last updated: <span className="text-zinc-200 font-semibold">{LAST_UPDATED}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span>App: {APP_NAME}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-emerald-400 font-semibold">Zero Third-Party Sharing</span>
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-[#101014]/80 backdrop-blur-sm p-5 text-sm leading-relaxed text-zinc-300 shadow-xl shadow-black/40">
              Welcome to <strong className="text-white">{APP_NAME}</strong> (
              <a
                href={APP_URL}
                className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 font-mono text-xs transition-colors"
              >
                {APP_URL}
              </a>
              ). This Privacy Policy transparently explains how we collect, handle, and protect your information when using our campus placement intelligence service. By authenticating with {APP_NAME}, you consent to the data practices described in this document.
            </div>
          </div>
        </AnimatedSection>

        {/* Legal Sections */}
        <div className="space-y-5">
          {/* 1. Information We Collect */}
          <AnimatedSection delay={50}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">01</span>
                <h2 className="text-lg font-bold text-white">Information We Collect</h2>
              </div>

              <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-colors">
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    1.1 Google Account Profile
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    When signing in via Google OAuth, we receive basic identity metadata: your full name, primary email address, and avatar URL. This information is utilized exclusively to establish and display your candidate session.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      1.2 Gmail Data & Message Parsing
                    </h3>
                    <code className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-[10px]">
                      gmail.readonly
                    </code>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {APP_NAME} requests read-only authorization to your mailbox solely to index official campus placement correspondence. Specifically, this access is used to:
                  </p>
                  <ul className="space-y-1.5 ml-1">
                    {[
                      'Identify campus placement emails from official CDC/NeoPAT senders (e.g., noreply.cdcinfo@vitstudent.ac.in).',
                      'Extract company profiles, test schedules, PPT invitations, and interview rounds.',
                      'Sync drive status (Registered, Test, Interview, Selected) to your dashboard.',
                      'Match your Candidate Registration ID against shortlist attachments (PDFs and Excel sheets).',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-zinc-500 font-mono">
                    🔒 We strictly do NOT read personal emails, bank statements, personal correspondence, or any messages outside verified placement sender patterns.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      1.3 Google Calendar Data (Optional)
                    </h3>
                    <code className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-[10px]">
                      calendar.events
                    </code>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    If you opt into Google Calendar sync, we utilize the <code className="text-zinc-300 font-mono text-[11px]">calendar.events</code> scope strictly to publish and update recruitment timelines, assessments, and interview slots to your personal calendar.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-colors">
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    1.4 User-Provided Credentials
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    During onboarding or in Settings, you provide your Candidate Registration ID and College Gmail address. These identifiers are stored securely and used only to match your name on shortlist rosters.
                  </p>
                </div>
              </div>
            </section>
          </AnimatedSection>

          {/* 2. How We Use Your Information */}
          <AnimatedSection delay={80}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">02</span>
                <h2 className="text-lg font-bold text-white">How We Use Information</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                All parsed data is strictly utilized to provide automated placement tracking services directly to you:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  { title: 'Drive Management', desc: 'Displaying upcoming deadlines, registrations, and CTC packages.' },
                  { title: 'Shortlist Verification', desc: 'Alerting you when your candidate ID appears in shortlisted results.' },
                  { title: 'Assessment Calendar', desc: 'Populating your agenda with test links and interview windows.' },
                  { title: 'Push Notifications', desc: 'Sending opt-in instant browser alerts for urgent placement circulars.' },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {item.title}
                    </div>
                    <p className="text-[11px] text-zinc-400">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
                <EyeOff className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300/90 leading-relaxed font-mono">
                  We DO NOT sell, rent, monetize, or trade your data. We DO NOT share your data with advertisers, third-party brokers, or data analytics firms. We DO NOT use your email data to train public AI/LLM models.
                </p>
              </div>
            </section>
          </AnimatedSection>

          {/* 3. Storage & Cryptography */}
          <AnimatedSection delay={100}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">03</span>
                <h2 className="text-lg font-bold text-white">Data Storage & Cryptographic Security</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                We implement industry-grade defense-in-depth security standards to protect your credentials and indexed records:
              </p>

              <div className="space-y-3">
                {[
                  {
                    icon: <Database className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />,
                    title: 'Supabase PostgreSQL with Row-Level Security (RLS)',
                    desc: 'Your synced records reside in an enterprise PostgreSQL database protected by strict Row-Level Security policies. Users can only query and mutate their own authenticated data partition.',
                  },
                  {
                    icon: <KeyRound className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />,
                    title: 'AES-256 Token Encryption at Rest',
                    desc: 'OAuth refresh tokens are cryptographically encrypted using AES-256 before being committed to persistent storage. Encryption keys are decoupled from application databases.',
                  },
                  {
                    icon: <Server className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />,
                    title: 'Zero Password Footprint & Ephemeral Ingestion',
                    desc: 'We never see or store your Google password. Email message contents are parsed in memory, transformed into structured drive events, and raw bodies are never retained indefinitely.',
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 flex items-start gap-3 hover:border-zinc-700/60 transition-colors">
                    {item.icon}
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200">{item.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </AnimatedSection>

          {/* 4. Google API Limited Use */}
          <AnimatedSection delay={120}>
            <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#101014]/80 to-[#0c1410]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-emerald-500/40 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Google API Services — Limited Use Disclosure</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300 mb-4">
                {APP_NAME}&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold transition-colors"
                >
                  Google API Services User Data Policy <ExternalLink className="h-3.5 w-3.5 inline" />
                </a>
                , including the Limited Use requirements:
              </p>

              <div className="space-y-2.5">
                {[
                  'We only use access to read Gmail messages to provide placement tracking and scheduling features directly visible to the candidate within the app.',
                  'We do not transfer Gmail data to third parties for advertising, market research, or data enrichment.',
                  'We do not use Gmail data for serving advertisements, retargeting, or interest profiling.',
                  'Human access is strictly prohibited: No employee, developer, or contractor reads your raw email bodies. Ingestion is entirely automated via secure serverless execution.',
                ].map((clause, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-3 text-xs text-zinc-300 hover:border-zinc-700/60 transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{clause}</span>
                  </div>
                ))}
              </div>
            </section>
          </AnimatedSection>

          {/* 5. Your Rights */}
          <AnimatedSection delay={140}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-2 py-1">05</span>
                <h2 className="text-lg font-bold text-white">Your Rights & Data Erasure</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                You maintain unconditioned control over your personal data at all times:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                  <h3 className="text-xs font-bold text-white mb-1">Instant Account Deletion</h3>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    Permanently erase all synced emails, company records, and credentials from Settings → Danger Zone.
                  </p>
                  <Link href="/settings" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                    Settings Page →
                  </Link>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                  <h3 className="text-xs font-bold text-white mb-1">Revoke OAuth Tokens</h3>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    Revoke app permissions directly from your Google Security console at any time.
                  </p>
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
                  >
                    Google Security <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 hover:border-zinc-700/60 transition-colors">
                  <h3 className="text-xs font-bold text-white mb-1">Data Portability</h3>
                  <p className="text-[11px] text-zinc-400 mb-3">
                    Request an export of all structured drive records associated with your account.
                  </p>
                  <Link href="/feedback" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                    Contact Support →
                  </Link>
                </div>
              </div>
            </section>
          </AnimatedSection>

          {/* 6. Contact */}
          <AnimatedSection delay={160}>
            <section className="rounded-2xl border border-zinc-800/60 bg-[#101014]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/40 hover:border-zinc-700/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-5">
                <Mail className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Contact & Support Desk</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                If you have any questions regarding this Privacy Policy, compliance audits, or data deletion procedures, please submit a ticket through our Feedback & Support Desk:
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">{APP_NAME} Engineering Desk</p>
                  <p className="text-[11px] text-zinc-500 font-mono">VIT Bhopal University · Student Platform</p>
                </div>
                <Link
                  href="/feedback"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <span>Submit Support Inquiry →</span>
                </Link>
              </div>
            </section>
          </AnimatedSection>
        </div>

        {/* Footer */}
        <AnimatedSection delay={180}>
          <div className="mt-16 pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
            <div className="flex items-center justify-center gap-3 sm:gap-4 whitespace-nowrap text-[11px]">
              <Link href="/terms" className="hover:text-zinc-200 transition-colors whitespace-nowrap">
                Terms of Service
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
