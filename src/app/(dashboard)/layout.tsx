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
    <div className="min-h-screen bg-bg-primary relative w-full max-w-full overflow-x-clip">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60 w-full max-w-full">
        <Topbar
          userName={session.name}
          userAvatar={session.avatar}
          lastSyncAt={lastSyncAt}
        />
        <main className="flex-1 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-20 2xl:px-24 py-6 sm:py-8 pb-28 lg:pb-12 min-w-0 w-full">
          {children}
        </main>
      </div>
      <MobileNav />
      <ChatAssistant />
    </div>
  );
}
