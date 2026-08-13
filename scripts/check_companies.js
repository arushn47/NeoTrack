const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mltfzskewmpifnyleevb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdGZ6c2tld21waWZueWxlZXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ2NDM1MSwiZXhwIjoyMTAyMDQwMzUxfQ.dbRcy5PHUIbcrwyICG-mM4jg5KOKtLUiWBeVfRSTETI'
);

async function main() {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, applications(status, ctc, applied_at, last_updated), events(id, title, start_time, event_type)');

  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }

  console.log('Total companies:', companies.length);
  const statusCounts = {};
  for (const c of companies) {
    const app = c.applications?.[0];
    const status = app?.status || 'none';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const evts = (c.events || []).map(e => `${e.event_type} (${e.start_time})`).join(', ');
    console.log(`Company: ${c.name.padEnd(25)} | Status: ${status.padEnd(16)} | Events: [${evts}]`);
  }
  console.log('\nStatus breakdown:', statusCounts);
}

main();
