const { Client } = require('pg');

const sql = `
GRANT ALL ON TABLE public.push_subscriptions TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.notification_preferences TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.notifications TO postgres, service_role, authenticated, anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
`;

const regions = [
  'ap-southeast-1',
  'ap-south-1',
  'us-east-1',
  'us-east-2',
  'eu-central-1',
  'eu-west-1',
  'us-west-1',
  'us-west-2'
];

async function run() {
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    const client = new Client({
      connectionString: `postgres://postgres.mltfzskewmpifnyleevb:R8DV6eNv2TrbGWwy@${host}:6543/postgres`,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log('Connected via pooler region:', r);
      await client.query(sql);
      console.log('Successfully granted all table permissions to service_role and authenticated roles!');
      await client.end();
      return;
    } catch (err) {
      console.error(`Failed on region ${r}:`, err.message);
    }
  }
  console.error('Could not connect to any pooler region.');
}

run().catch((err) => {
  console.error('Permission grant failed:', err);
  process.exit(1);
});
