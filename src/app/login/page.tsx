import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginClient from './login-client';

export const metadata = {
  title: 'Sign In — NeoPAT Placement Tracker',
  description: 'Sign in with Google to start tracking your campus placements.',
};

export default async function LoginPage() {
  // If already logged in, redirect to dashboard
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  return <LoginClient />;
}
