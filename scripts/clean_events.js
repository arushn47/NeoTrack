const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mltfzskewmpifnyleevb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdGZ6c2tld21waWZueWxlZXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ2NDM1MSwiZXhwIjoyMTAyMDQwMzUxfQ.dbRcy5PHUIbcrwyICG-mM4jg5KOKtLUiWBeVfRSTETI'
);

async function cleanEvents() {
  const { data: events } = await supabase.from('events').select('*');
  console.log('Total events in DB:', events.length);

  for (const evt of events) {
    if (evt.start_time && evt.start_time.includes('2026-08-13T14:30:00')) {
      console.log('Fixing shifted MUFG test event from 14:30 UTC (8:00 PM IST) to 09:00 UTC (2:30 PM IST):', evt.id);
      await supabase
        .from('events')
        .update({
          start_time: '2026-08-13T09:00:00.000Z',
          end_time: '2026-08-13T10:30:00.000Z',
        })
        .eq('id', evt.id);
    }
  }

  // Deduplicate events for the same company and day
  const { data: refreshed } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  const seen = new Set();
  for (const evt of refreshed) {
    const day = evt.start_time ? evt.start_time.split('T')[0] : 'no-time';
    const key = `${evt.company_id}:${evt.event_type}:${day}`;
    if (seen.has(key)) {
      console.log('Deleting duplicate event:', evt.id, key);
      await supabase.from('events').delete().eq('id', evt.id);
    } else {
      seen.add(key);
    }
  }

  console.log('Event cleanup complete.');
}

cleanEvents();
