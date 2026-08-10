/**
 * Bulk image migration: local files → Replit Object Storage → update DB
 * Run from: artifacts/api-server/
 *   node migrate-images.mjs
 */
import { readFileSync } from 'fs';
import { Storage } from '@google-cloud/storage';
import pg from 'pg';
import { randomUUID } from 'crypto';

const SIDECAR = 'http://127.0.0.1:1106';

const storage = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${SIDECAR}/token`,
    type: 'external_account',
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR;
if (!PRIVATE_DIR) throw new Error('PRIVATE_OBJECT_DIR not set');

// Parse "/bucketName/some/prefix" → { bucketName, prefix }
const parts = PRIVATE_DIR.replace(/^\//, '').split('/');
const bucketName = parts[0];
const dirPrefix = parts.slice(1).join('/');
const bucket = storage.bucket(bucketName);

const { Pool } = pg.default ?? pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function mimeFromPath(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
           webp: 'image/webp', gif: 'image/gif' }[ext] ?? 'image/jpeg';
}

// full Supabase base URL
const BASE = 'https://arkcpveujkddkxqekueg.supabase.co/storage/v1/object/public/menu/';

// Map: localFile (relative to /tmp/menu_images/) → filename as it appears in Supabase URL
const IMAGES = [
  // ── Pizzas ───────────────────────────────────────────────────────────────
  ['pizzas/Fotos menu/Amsterdam-WA0022.jpg',     'Amsterdam-WA0022.jpg'],
  ['pizzas/Fotos menu/Argentina-WA0017.jpg',     'Argentina-WA0017.jpg'],
  ['pizzas/Fotos menu/Atún-WA0042.jpg',          'Atun-WA0042.jpg'],
  ['pizzas/Fotos menu/Banana y canela-WA0040.jpg','Banana%20y%20canela-WA0040.jpg'],
  ['pizzas/Fotos menu/Barbacoa-WA0052.jpg',      'Barbacoa-WA0052.jpg'],
  ['pizzas/Fotos menu/Calabresa-WA0035.jpg',     'Calabresa-WA0035.jpg'],
  ['pizzas/Fotos menu/Calabresaespecial.png',    'Calabresaespecial.png'],
  ['pizzas/Fotos menu/Caprese-WA0024.jpg',       'Caprese-WA0024.jpg'],
  ['pizzas/Fotos menu/Carioca-WA0046.jpg',       'Carioca-WA0046.jpg'],
  ['pizzas/Fotos menu/Carnívora-WA0009.jpg',     'Carnivora-WA0009.jpg'],
  ['pizzas/Fotos menu/Catalana-WA0033(1).jpg',   'Catalana-WA0033(1).jpg'],
  ['pizzas/Fotos menu/Crujiente-WA0013.jpg',     'Crujiente-WA0013.jpg'],
  ['pizzas/Fotos menu/Cuatroquesos.png',         'Cuatroquesos.png'],
  ['pizzas/Fotos menu/Del chef-WA0015.jpg',      'Del%20chef-WA0015.jpg'],
  ['pizzas/Fotos menu/Doritos.png',              'Doritos.png'],
  ['pizzas/Fotos menu/Dubai-WA0038.jpg',         'Dubai-WA0038.jpg'],
  ['pizzas/Fotos menu/Funghi-WA0044.jpg',        'Funghi-WA0044.jpg'],
  ['pizzas/Fotos menu/Granjera-WA0048.jpg',      'Granjera-WA0048.jpg'],
  ['pizzas/Fotos menu/Hawaiana Fuego-WA0006.jpg','Hawaiana%20Fuego-WA0006.jpg'],
  ['pizzas/Fotos menu/Ibérica.png',              'Iberica.png'],
  ['pizzas/Fotos menu/M&Ms.png',                 'M%26Ms.png'],
  ['pizzas/Fotos menu/Mafiosa.png',              'Mafiosa.png'],
  ['pizzas/Fotos menu/Marguerita.png',           'Marguerita.png'],
  ['pizzas/Fotos menu/Mozzarella-WA0021.jpg',    'Mozzarella-WA0021.jpg'],
  ['pizzas/Fotos menu/Picaña-WA0037.jpg',        'Picana-WA0037.jpg'],
  ['pizzas/Fotos menu/Piña Nevada-WA0039.jpg',   'Pina%20Nevada-WA0039.jpg'],
  ['pizzas/Fotos menu/Pizzaiolo-WA0011.jpg',     'Pizzaiolo-WA0011.jpg'],
  ['pizzas/Fotos menu/Portuguesa-WA0041.jpg',    'Portuguesa-WA0041.jpg'],
  ['pizzas/Fotos menu/Putanesca.png',            'Putanesca.png'],
  ['pizzas/Fotos menu/Ruffles-WA0030(1).jpg',    'Ruffles-WA0030.jpg'],
  ['pizzas/Fotos menu/Sensación-WA0051.jpg',     'Sensacion-WA0051.jpg'],
  ['pizzas/Fotos menu/Strogonoff-WA0019.jpg',    'Strogonoff-WA0019.jpg'],
  ['pizzas/Fotos menu/Tomateseco.png',           'Tomateseco.png'],
  ['pizzas/Fotos menu/Uva trufada-WA0043.jpg',   'Uva%20trufada-WA0043.jpg'],
  ['pizzas/Fotos menu/Vegetariana.png',          'Vegetariana.png'],
  // ── Bebidas ──────────────────────────────────────────────────────────────
  ['bebidas/agua-mineral-veri-330-ml-pack-35-botellas.jpg', 'agua-mineral-veri-330-ml-pack-35-botellas.jpg'],
  ['bebidas/aquarius limon.jpeg',   'aquarius%20limon.webp'],
  ['bebidas/aquarius naranja.jpg',  'aquarius%20naranja.webp'],
  ['bebidas/cola cero.jpeg',        'coca%20cola%20zero.webp'],
  ['bebidas/fanta.jpeg',            'fanta%20de%20naranja.jpg'],
  ['bebidas/fusie tea.jpg',         'fusie%20tea.jpg'],
  ['bebidas/Guaraná.jpeg',          'guarana%20antartica.jpeg'],
  ['bebidas/lata-coca-cola.jpg',    'lata%20coca%20cola.jpg'],
  ['bebidas/sprite.jpeg',           'sprite.webp'],
];

const urlMapping = [];
let ok = 0;
const errors = [];

for (const [relPath, supabaseFile] of IMAGES) {
  const fullPath = `/tmp/menu_images/${relPath}`;
  const supabaseUrl = `${BASE}${supabaseFile}`;
  try {
    const buffer = readFileSync(fullPath);
    const contentType = mimeFromPath(relPath);
    const uuid = randomUUID();
    const objectName = dirPrefix ? `${dirPrefix}/uploads/${uuid}` : `uploads/${uuid}`;
    const gcsFile = bucket.file(objectName);

    // Upload
    await gcsFile.save(buffer, { contentType, resumable: false });

    // Set public ACL metadata
    await gcsFile.setMetadata({
      metadata: {
        'custom:aclPolicy': JSON.stringify({ owner: 'admin', visibility: 'public' }),
      },
    });

    const newImageUrl = `/api/storage/objects/uploads/${uuid}`;

    // Update dev DB
    const { rowCount } = await pool.query(
      'UPDATE menu_items SET image_url = $1 WHERE image_url = $2',
      [newImageUrl, supabaseUrl]
    );

    urlMapping.push({ supabaseUrl, newImageUrl, devRows: rowCount });
    ok++;
    process.stdout.write(`✅ ${ok}/${IMAGES.length} ${supabaseFile}\n`);
  } catch (e) {
    errors.push({ file: relPath, error: e.message });
    process.stderr.write(`❌ ${relPath}: ${e.message}\n`);
  }
}

await pool.end();

console.log(`\n=== DONE: ${ok} uploaded, ${errors.length} errors ===`);
if (errors.length) console.log('Errors:', JSON.stringify(errors, null, 2));

// Output mapping for prod DB sync
console.log('\n=== URL_MAPPING_JSON ===');
console.log(JSON.stringify(urlMapping));
