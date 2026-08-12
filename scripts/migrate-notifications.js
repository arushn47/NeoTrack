const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'migration_v2.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

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
      console.log('Migration v2 executed successfully on live Supabase DB!');
      await client.end();
      return;
    } catch (err) {
      console.error(`Failed on region ${r}:`, err.message);
    }
  }
  console.error('Could not connect to any pooler region.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
