import { Client } from 'pg';
import fs from 'fs';

const connectionString = 'postgresql://postgres.kbvdhtrqktkdgjacsjuh:1JezyKIai4W5cQlB@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

async function runSeed() {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('./supabase/seed.sql', 'utf8');
    await client.query(sql);
    console.log('Seed ejecutado exitosamente');
  } catch (err) {
    console.error('Error ejecutando seed:', err);
  } finally {
    await client.end();
  }
}

runSeed();
