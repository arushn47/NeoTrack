const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mltfzskewmpifnyleevb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdGZ6c2tld21waWZueWxlZXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ2NDM1MSwiZXhwIjoyMTAyMDQwMzUxfQ.dbRcy5PHUIbcrwyICG-mM4jg5KOKtLUiWBeVfRSTETI'
);

async function checkNotifications() {
  const { data: users } = await supabase.from('users').select('id, email, neo_id');
  console.log('Users in DB:', users);

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  console.log('\nPush Subscriptions count:', subs?.length || 0);
  console.log(subs);

  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, type, title, message, body, link, is_read, dedupe_key, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nRecent Notifications count:', notifs?.length || 0);
  console.log(notifs);

  const { data: prefs } = await supabase.from('notification_preferences').select('*');
  console.log('\nNotification Preferences count:', prefs?.length || 0);
  console.log(prefs);
}

checkNotifications();
