import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — NeoTrack',
  description:
    'Learn how NeoTrack collects, uses, and protects your data when you use our campus placement tracking service.',
  alternates: {
    canonical: '/privacy',
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'September 12, 2026';
const APP_NAME = 'NeoTrack';
const APP_URL = 'https://neopat-tracker.vercel.app';
const CONTACT_EMAIL = 'arushn.2005@gmail.com';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a10] text-zinc-300 selection:bg-indigo-500/20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a10]/90 backdrop-blur-2xl border-b border-zinc-800/80 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm font-mono">N</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight font-mono">
              Neo<span className="text-indigo-400">Track</span>
            </span>
          </Link>
          <Link
            href="/terms"
            className="text-xs text-zinc-400 hover:text-indigo-300 transition-colors"
          >
            Terms of Service →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Title */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full mb-4 font-mono">
            Legal Document
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-400">
            Last updated: <span className="text-zinc-300 font-medium">{LAST_UPDATED}</span>
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed">
          {/* Intro */}
          <section>
            <p className="text-zinc-300">
              Welcome to <span className="text-indigo-300 font-semibold">{APP_NAME}</span> (
              <a href={APP_URL} className="text-indigo-400 hover:underline">{APP_URL}</a>). This
              Privacy Policy explains what information we collect, how we use it, and your rights
              regarding your data when you use our campus placement tracking service.
            </p>
            <p className="text-zinc-400 mt-3">
              By using {APP_NAME}, you agree to the practices described in this policy. If you do
              not agree, please do not use the service.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-zinc-200 mb-2">
              1.1 Google Account Information
            </h3>
            <p className="text-zinc-400 mb-3">
              When you sign in with Google, we receive basic profile information: your name, email
              address, and profile picture. This is used solely to identify your account within
              {APP_NAME}.
            </p>

            <h3 className="text-sm font-semibold text-zinc-200 mb-2">1.2 Gmail Data</h3>
            <p className="text-zinc-400 mb-3">
              {APP_NAME} requests access to read your Gmail messages (using the{' '}
              <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-[11px]">
                https://www.googleapis.com/auth/gmail.readonly
              </code>{' '}
              scope). We use this access to:
            </p>
            <ul className="list-none space-y-2 ml-1">
              {[
                'Identify campus placement-related emails from official CDC/NeoPAT senders',
                'Extract company names, test dates, interview rounds, and shortlist information',
                'Sync placement drive status to your personal dashboard',
                'Match your NeoPAT Registration ID against shortlist PDFs/spreadsheets in attachments',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-3">
              We only read emails that match placement-related patterns (specific senders like{' '}
              <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-[11px]">
                noreply.cdcinfo@vitstudent.ac.in
              </code>{' '}
              and keywords like "shortlist", "interview", "test schedule"). We do{' '}
              <strong className="text-white">not</strong> read personal emails, financial data, or
              any unrelated messages.
            </p>

            <h3 className="text-sm font-semibold text-zinc-200 mb-2 mt-5">
              1.3 Google Calendar Data
            </h3>
            <p className="text-zinc-400 mb-3">
              If you connect Google Calendar (optional), we request the{' '}
              <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-[11px]">
                https://www.googleapis.com/auth/calendar.events
              </code>{' '}
              scope to automatically create and manage placement drive calendar events on your
              behalf.
            </p>

            <h3 className="text-sm font-semibold text-zinc-200 mb-2 mt-5">
              1.4 User-Provided Data
            </h3>
            <p className="text-zinc-400">
              You may also provide your NeoPAT Registration ID and a college Gmail address during
              onboarding. This data is stored securely and used only within the app to match you
              against shortlists.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 2. How We Use Your Information */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              2. How We Use Your Information
            </h2>
            <ul className="list-none space-y-2">
              {[
                'To authenticate and identify you across sessions',
                'To sync and index your placement-related Gmail messages into your dashboard',
                'To automatically create Google Calendar events for tests, interviews, and PPTs',
                'To show you a real-time placement pipeline: shortlists, test dates, offer status',
                'To send browser push notifications for shortlist and schedule updates (if enabled)',
                'To display analytics on your placement performance',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-4">
              We do <strong className="text-white">not</strong> sell your data, share it with
              advertisers, use it to train AI/ML models, or share it with third parties other than
              the infrastructure providers listed below.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 3. Data Storage */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">3. Data Storage & Security</h2>
            <p className="text-zinc-400 mb-3">
              Your data is stored on{' '}
              <a
                href="https://supabase.com"
                className="text-indigo-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Supabase
              </a>{' '}
              (PostgreSQL database with Row-Level Security enforced — only you can read your own
              data). The application is hosted on{' '}
              <a
                href="https://vercel.com"
                className="text-indigo-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel
              </a>
              .
            </p>
            <p className="text-zinc-400 mb-3">
              Gmail and Calendar OAuth tokens are encrypted at rest using AES-256 encryption before
              being stored. Tokens are never logged or exposed in any API response.
            </p>
            <p className="text-zinc-400">
              We do not store your Gmail password, and we never modify or send emails on your behalf.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 4. Google API Limited Use */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              4. Google API Services — Limited Use Disclosure
            </h2>
            <p className="text-zinc-400">
              {APP_NAME}&apos;s use and transfer of information received from Google APIs to any
              other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-indigo-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically:
            </p>
            <ul className="list-none space-y-2 mt-3">
              {[
                'We only use Gmail data to provide placement tracking features within the app',
                'We do not transfer Gmail data to third parties for advertising or any other purpose',
                'We do not use Gmail data for purposes unrelated to placement tracking',
                'Humans do not read your Gmail data; access is limited to automated, server-side processing',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-zinc-800" />

          {/* 5. Your Rights */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">5. Your Rights & Data Control</h2>
            <ul className="list-none space-y-2">
              {[
                {
                  title: 'Delete your account',
                  detail:
                    'You can delete your account and all associated data from Settings → Danger Zone. This permanently removes all your synced emails, companies, and application data.',
                },
                {
                  title: 'Revoke Google access',
                  detail:
                    'You can revoke NeoTrack\'s access to your Google account at any time via myaccount.google.com/permissions. This will disconnect Gmail sync.',
                },
                {
                  title: 'Export your data',
                  detail:
                    'Contact us at ' + CONTACT_EMAIL + ' to request a copy of your stored data.',
                },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  <span>
                    <strong className="text-zinc-200">{item.title}:</strong> {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-zinc-800" />

          {/* 6. Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">6. Cookies & Sessions</h2>
            <p className="text-zinc-400">
              We use a single session cookie (HttpOnly, Secure) to keep you logged in. We do not
              use tracking cookies, advertising pixels, or any third-party analytics cookies.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 7. Changes */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">7. Changes to This Policy</h2>
            <p className="text-zinc-400">
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by updating the &quot;Last updated&quot; date at the top of this page. Your
              continued use of {APP_NAME} after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 8. Contact */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">8. Contact</h2>
            <p className="text-zinc-400">
              For privacy-related questions, data deletion requests, or concerns, please contact:
            </p>
            <div className="mt-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-200 font-medium">{APP_NAME} — Developer</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-indigo-400 hover:underline text-sm font-mono"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-14 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-indigo-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              Back to App
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
