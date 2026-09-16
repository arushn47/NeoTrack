'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Bell, X, Download, Share2, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { cn } from '@/lib/utils';

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true until mounted to prevent hydration flicker
  const [justSubscribed, setJustSubscribed] = useState(false);

  const {
    isSupported: isPushSupported,
    isSubscribed,
    loading: pushLoading,
    subscribeToPush,
  } = usePushNotifications();

  useEffect(() => {
    // Check if dismissed previously in localStorage
    const dismissed = localStorage.getItem('neotrack_pwa_banner_dismissed') === 'true';
    setIsDismissed(dismissed);

    // Detect if already installed / running in standalone window
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIosDevice);

    // Listen for beforeinstallprompt on Android / Chromium
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('neotrack_pwa_banner_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleEnableNotifications = async () => {
    const success = await subscribeToPush();
    if (success) {
      setJustSubscribed(true);
      setTimeout(() => setJustSubscribed(false), 4000);
    }
  };

  // If already running standalone AND notifications already enabled, or dismissed: hide banner
  if (isDismissed || (isStandalone && isSubscribed)) {
    return null;
  }

  return (
    <div
      data-testid="pwa-install-banner"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-zinc-900/70 to-indigo-950/40 p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-emerald-950/20 transition-all"
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl" />

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors"
        title="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6 sm:pr-0">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 text-emerald-300 shadow-inner">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
                Install App on Your Phone
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  Instant Shortlist Alerts
                </span>
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-400 max-w-xl leading-relaxed">
              Add Where&apos;s My Offer? to your home screen and turn on push notifications to receive real-time alerts the second test shortlists, PPT venues, or interview slots are announced.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* Notification Button */}
          {isPushSupported && !isSubscribed && (
            <button
              onClick={handleEnableNotifications}
              disabled={pushLoading || justSubscribed}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shadow-sm",
                justSubscribed
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:scale-[0.98]"
              )}
            >
              {justSubscribed ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Notifications Enabled!</span>
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 shrink-0" />
                  <span>{pushLoading ? 'Enabling...' : 'Turn on Notifications'}</span>
                </>
              )}
            </button>
          )}

          {/* Android / Chrome One-Tap Install */}
          {deferredPrompt && !isStandalone && (
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all active:scale-[0.98]"
            >
              <Download className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>Install to Phone</span>
            </button>
          )}

          {/* iOS Safari Instructions */}
          {isIOS && !isStandalone && (
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-3 py-1.5 text-[11px] text-zinc-300 font-medium">
              <Share2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>Tap <strong className="text-zinc-100">Share</strong> ⎋ then <strong className="text-zinc-100">&apos;Add to Home Screen&apos;</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
