/**
 * Aplica una migración a la base de datos, en una sola transacción.
 *
 *   node scripts/aplicar-migracion.mjs supabase/migrations/<archivo>.sql
 *
 * Si algo falla, la transacción se revierte entera y la base queda como estaba.
 * La conexión sale de DATABASE_URL o, si no está definida, de `execute-seed.mjs`.
 */
import { Client } from 'pg';
import fs from 'fs';

function conexion() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const seed = fs.readFileSync('./execute-seed.mjs', 'utf8');
  const match = seed.match(/connectionString\s*=\s*'([^']+)'/);
  if (!match) throw new Error('Define DATABASE_URL para poder conectarte.');
  return match[1];
}

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/aplicar-migracion.mjs <archivo.sql>');
  process.exit(1);
}

const client = new Client({ connectionString: conexion() });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(fs.readFileSync(ruta, 'utf8'));
  await client.query('COMMIT');
  console.log(`✅ Migración aplicada: ${ruta}`);
} catch (err) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* la conexión ya se cayó */
  }
  console.error(`❌ No se aplicó nada. Error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
