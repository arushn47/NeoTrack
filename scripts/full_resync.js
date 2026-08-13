const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mltfzskewmpifnyleevb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdGZ6c2tld21waWZueWxlZXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ2NDM1MSwiZXhwIjoyMTAyMDQwMzUxfQ.dbRcy5PHUIbcrwyICG-mM4jg5KOKtLUiWBeVfRSTETI'
);

async function fullResetAndResync() {
  console.log('--- Starting Full Resync & State Recalibration ---');

  // Reset last_synced_email_date on all accounts so sync scans everything from day 1
  const { data: accounts, error } = await supabase
    .from('gmail_accounts')
    .select('*');

  if (error || !accounts) {
    console.error('Failed to fetch accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} connected accounts.`);
  for (const acc of accounts) {
    console.log(`Resetting sync cursor for ${acc.email} (${acc.account_type})...`);
    await supabase
      .from('gmail_accounts')
      .update({
        last_synced_email_date: null,
        history_id: null,
      })
      .eq('id', acc.id);
  }

  console.log('\nAll sync cursors reset to initial state!');
  console.log('Now, when sync runs, it will process all placement emails and Excel shortlists from scratch.');
}

fullResetAndResync();
