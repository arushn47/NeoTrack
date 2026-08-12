import { requireSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import Sidebar from '@/components/layout/sidebar';
import Topbar from '@/components/layout/topbar';
import MobileNav from '@/components/layout/mobile-nav';
import ChatAssistant from '@/components/shared/chat-assistant';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Fetch last sync time
  const supabase = createAdminClient();
  const { data: accounts } = await supabase
    .from('gmail_accounts')
    .select('last_sync_at')
    .eq('user_id', session.userId)
    .eq('is_connected', true)
    .order('last_sync_at', { ascending: false })
    .limit(1);

  const lastSyncAt = accounts?.[0]?.last_sync_at || null;

  return (
    <div className="flex min-h-screen bg-bg-primary relative">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={session.name}
          userAvatar={session.avatar}
          lastSyncAt={lastSyncAt}
        />
        <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>
      <MobileNav />
      <ChatAssistant />
    </div>
  );
}
