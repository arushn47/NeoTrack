import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — NeoTrack',
  description:
    'Read the Terms of Service for NeoTrack, the campus placement tracking service for VIT students.',
  alternates: {
    canonical: '/terms',
  },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'September 12, 2026';
const APP_NAME = 'NeoTrack';
const APP_URL = 'https://neopat-tracker.vercel.app';
const CONTACT_EMAIL = 'arushn.2005@gmail.com';

export default function TermsPage() {
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
            href="/privacy"
            className="text-xs text-zinc-400 hover:text-indigo-300 transition-colors"
          >
            Privacy Policy →
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
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-400">
            Last updated: <span className="text-zinc-300 font-medium">{LAST_UPDATED}</span>
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed">
          {/* Intro */}
          <section>
            <p className="text-zinc-300">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of{' '}
              <span className="text-indigo-300 font-semibold">{APP_NAME}</span> (
              <a href={APP_URL} className="text-indigo-400 hover:underline">
                {APP_URL}
              </a>
              ), a campus placement tracking service built for VIT students. By using{' '}
              {APP_NAME}, you agree to these Terms.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 1. Acceptance */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-400">
              By accessing or using {APP_NAME}, you confirm that you are at least 13 years old, a
              current or prospective student of VIT Bhopal University, and that you agree to be
              bound by these Terms and our{' '}
              <Link href="/privacy" className="text-indigo-400 hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree, please stop using the service immediately.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">2. Description of Service</h2>
            <p className="text-zinc-400 mb-3">
              {APP_NAME} is a personal productivity tool that helps you track campus placement
              drives, online assessments, interviews, and offers. The service works by:
            </p>
            <ul className="list-none space-y-2 ml-1">
              {[
                'Reading placement-related emails from your connected Gmail account(s)',
                'Indexing company names, test dates, shortlists, and application status',
                'Displaying a unified placement dashboard and calendar',
                'Sending optional browser push notifications for important placement events',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-4">
              {APP_NAME} is provided &quot;as is&quot; as a free, personal-use service. We make no
              guarantees about accuracy, uptime, or completeness of placement data.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 3. Google Account & OAuth */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              3. Google Account Access
            </h2>
            <p className="text-zinc-400 mb-3">
              {APP_NAME} requires you to sign in with your Google account and grant the following
              permissions:
            </p>
            <ul className="list-none space-y-2 ml-1">
              {[
                {
                  scope: 'gmail.readonly',
                  use: 'Read placement-related emails from your mailbox',
                },
                {
                  scope: 'calendar.events',
                  use: 'Create and manage placement drive calendar events (optional)',
                },
                {
                  scope: 'userinfo.email / userinfo.profile',
                  use: 'Display your name and avatar within the app',
                },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  <span>
                    <code className="text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      {item.scope}
                    </code>{' '}
                    — {item.use}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-zinc-400 mt-4">
              You can revoke these permissions at any time from{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-indigo-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              . Revoking access will disable Gmail sync but will not automatically delete your
              stored data — you can do that from the Settings page.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">4. Acceptable Use</h2>
            <p className="text-zinc-400 mb-3">You agree not to:</p>
            <ul className="list-none space-y-2 ml-1">
              {[
                'Use the service for any illegal purpose or in violation of any law',
                'Share your account credentials with others or create accounts on behalf of other users',
                'Attempt to reverse-engineer, scrape, or abuse the service\'s APIs',
                'Use the service to harvest or store data about students other than yourself',
                'Interfere with the service\'s infrastructure or attempt unauthorized access',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-zinc-800" />

          {/* 5. Data Accuracy */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">5. Data Accuracy Disclaimer</h2>
            <p className="text-zinc-400">
              {APP_NAME} uses automated email parsing and AI-assisted classification to extract
              placement information. While we strive for accuracy, we cannot guarantee that all
              placement statuses, dates, or company information are 100% correct.{' '}
              <strong className="text-white">
                Always verify critical placement information (shortlists, test links, interview
                times) directly with your college CDC or official emails.
              </strong>{' '}
              Do not rely solely on {APP_NAME} for time-sensitive placement decisions.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 6. Availability & Modifications */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              6. Service Availability & Modifications
            </h2>
            <p className="text-zinc-400 mb-3">
              {APP_NAME} is a personal project provided for free, without any uptime or availability
              guarantees. We may:
            </p>
            <ul className="list-none space-y-2 ml-1">
              {[
                'Modify, suspend, or discontinue the service at any time without notice',
                'Update these Terms at any time — continued use constitutes acceptance',
                'Add, remove, or change features without prior notice',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-400">
                  <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-zinc-800" />

          {/* 7. Limitation of Liability */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              7. Limitation of Liability
            </h2>
            <p className="text-zinc-400">
              To the fullest extent permitted by law, {APP_NAME} and its developer shall not be
              liable for any indirect, incidental, special, or consequential damages arising from
              your use of (or inability to use) the service, including missed placement
              opportunities, data loss, or inaccurate placement status. The service is provided{' '}
              <strong className="text-white">&quot;as is&quot; without warranty of any kind</strong>,
              express or implied.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 8. Termination */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">8. Termination</h2>
            <p className="text-zinc-400">
              You may stop using {APP_NAME} at any time. You can delete your account and all
              associated data from{' '}
              <Link href="/settings" className="text-indigo-400 hover:underline">
                Settings → Danger Zone
              </Link>
              . We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 9. Governing Law */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">9. Governing Law</h2>
            <p className="text-zinc-400">
              These Terms are governed by the laws of India. Any disputes arising from your use of{' '}
              {APP_NAME} shall be resolved in accordance with applicable Indian law.
            </p>
          </section>

          <hr className="border-zinc-800" />

          {/* 10. Contact */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">10. Contact</h2>
            <p className="text-zinc-400 mb-3">
              If you have questions about these Terms, please reach out:
            </p>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
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
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-indigo-400">
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
