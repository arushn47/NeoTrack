import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Sign In & Placement Command Center',
  description:
    'Sign in with Google to automatically track placement drives, match shortlist attachments, and get real-time interview alerts.',
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: 'Sign In — NeoTrack Campus Placement Command Center',
    description:
      'Never miss a shortlist, test, or interview. Real-time campus placement tracking and automated email parsing.',
    url: '/login',
  },
};

export default async function LoginPage() {
  // If already logged in, redirect to dashboard
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  return <LoginClient />;
}
