import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SettingsClient from './settings-client';

export const metadata = {
  title: 'Settings — NeoPAT Placement Tracker',
  description: 'Manage your Gmail accounts, Neo ID, and preferences.',
};

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = createAdminClient();

  const [{ data: accounts }, { data: user }] = await Promise.all([
    supabase
      .from('gmail_accounts')
      .select('id, email, account_type, is_connected, last_sync_at')
      .eq('user_id', session.userId),
    supabase
      .from('users')
      .select('neo_id')
      .eq('id', session.userId)
      .single(),
  ]);

  return (
    <SettingsClient
      accounts={accounts || []}
      neoId={user?.neo_id || ''}
      userEmail={session.email}
    />
  );
}
