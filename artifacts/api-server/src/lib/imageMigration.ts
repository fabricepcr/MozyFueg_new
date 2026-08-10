/**
 * One-time migration: replace Supabase image URLs with Replit Object Storage URLs.
 * Runs on startup if any menu_items still point to Supabase storage.
 * Safe to run multiple times (idempotent).
 */
import { pool } from '@workspace/db';
import { logger } from './logger';

const SUPABASE_TO_OBJECT_STORAGE: Record<string, string> = {
  'Pizza Amsterdam':          '/api/storage/objects/uploads/785f4520-cf72-424e-821e-beb8648efa99',
  'Pizza Argentina':          '/api/storage/objects/uploads/ea7c21a4-4cf3-4916-8434-23c69de4f505',
  'Pizza Atún':               '/api/storage/objects/uploads/61ed1009-47a8-4782-8e8c-b1920e0d1d27',
  'Pizza Banana y Canela':    '/api/storage/objects/uploads/626435a4-0b01-4aa0-a03b-d5bc59eb2d91',
  'Pizza Barbacoa':           '/api/storage/objects/uploads/7969bbf0-2042-49e2-bb13-f5ce71c30bd2',
  'Pizza Calabresa':          '/api/storage/objects/uploads/ad298049-add6-4b11-a112-63998e1a8258',
  'Pizza Calabresa Especial': '/api/storage/objects/uploads/f3556345-d16b-48f8-b7d2-f86082d6f25b',
  'Pizza Caprese':            '/api/storage/objects/uploads/5f760a3e-5354-49e2-a968-b54164ccb13a',
  'Pizza Carioca':            '/api/storage/objects/uploads/2207c348-f8ac-4b58-8026-e1553f4dd2a9',
  'Pizza Carnívora':          '/api/storage/objects/uploads/826c9e6f-d4ea-4037-95b8-121dc73857c7',
  'Pizza Catalana':           '/api/storage/objects/uploads/3d24cc13-3eb7-4b32-a9e0-d509a2f1068d',
  'Pizza Crujiente':          '/api/storage/objects/uploads/5a898ac4-16fe-4ad7-86ab-2f1cefe3186b',
  'Pizza Cuatro Quesos':      '/api/storage/objects/uploads/876bf759-ef3c-4c1f-9acd-d05d7be58809',
  'Pizza Del Chef':           '/api/storage/objects/uploads/d6ad19b3-255a-4289-8f22-7e4256a08856',
  'Pizza Doritos':            '/api/storage/objects/uploads/f17ba1ec-ea7e-4298-9a83-b4b0abcb654d',
  'Pizza Dubai':              '/api/storage/objects/uploads/bd36dac2-5b9c-46de-a866-8dec96b5ff29',
  'Pizza Funghi':             '/api/storage/objects/uploads/199b32af-437b-44bc-b1fa-8738286e23ad',
  'Pizza Granjera':           '/api/storage/objects/uploads/993c2bdc-1614-4b4d-8eae-f7788d76e0f0',
  'Pizza Hawaiana Fuego':     '/api/storage/objects/uploads/4d0d95ed-04bf-4160-aa25-45dbcf10fcb3',
  'Pizza Ibérica':            '/api/storage/objects/uploads/0df327f7-4e0b-4204-b787-4e27af472c52',
  'Pizza Mafiosa':            '/api/storage/objects/uploads/cac4999a-c084-4bac-926b-b3ce0cffef23',
  'Pizza Marguerita':         '/api/storage/objects/uploads/573dd403-3285-4dcb-b0dd-995b8ece9f66',
  'Pizza Mozzarella':         '/api/storage/objects/uploads/733410bd-69ab-4831-94ea-c4594a4c1ed0',
  'Pizza Picaña':             '/api/storage/objects/uploads/6a7be476-5f81-424a-977d-076dcc949455',
  'Pizza Piña Nevada':        '/api/storage/objects/uploads/9f1e4666-2dd5-416d-9baa-8f3f9297c9d9',
  'Pizza Pizzaiolo':          '/api/storage/objects/uploads/3947506c-ba9e-4cf3-a15a-4beab6a2c7b7',
  'Pizza Portuguesa':         '/api/storage/objects/uploads/9141c3f9-015e-4b8a-b283-1ef2372b5886',
  'Pizza Putanesca':          '/api/storage/objects/uploads/5c3c5c2e-4cf5-41ef-a3da-a2469f5fab52',
  'Pizza Ruffles':            '/api/storage/objects/uploads/b5f9e41f-1d1d-4cae-983b-dac89da30d1c',
  'Pizza Sensación':          '/api/storage/objects/uploads/dda22884-c947-4049-8342-86063c74bcc7',
  'Pizza Strogonoff':         '/api/storage/objects/uploads/0c0b4cf6-f394-4fc3-a121-f38f7be4f048',
  'Pizza Tomate Seco':        '/api/storage/objects/uploads/6fdc7582-8123-4ba9-b6d6-c6b768187925',
  'Pizza Uva Trufada':        '/api/storage/objects/uploads/14984472-fea6-4c7c-828b-83451c99fe6d',
  'Pizza Vegetariana':        '/api/storage/objects/uploads/bfba6860-9cc7-4db3-ba6d-c664bad6a7aa',
  'Agua sin gas':             '/api/storage/objects/uploads/eb2243fe-7040-46bf-ae4c-76f94c4c4abb',
  'Aquarius Limón':           '/api/storage/objects/uploads/12530447-3818-4920-982f-0f2dfb2e5e33',
  'Aquarius Naranja':         '/api/storage/objects/uploads/38e93c13-b759-481a-af81-50d7d8232a03',
  'Coca-Cola':                '/api/storage/objects/uploads/1b742efa-0c0e-4a2d-80b0-11193e2907f3',
  'Coca-Cola Zero':           '/api/storage/objects/uploads/ca7417b6-c155-43e9-bf71-8854f0316e28',
  'Fanta Naranja':            '/api/storage/objects/uploads/f2f114a3-38d8-489e-becd-f2cf3d91f792',
  'Fuze Tea':                 '/api/storage/objects/uploads/94c0bbb1-c27d-4858-9350-3aa27d75d9d3',
  'Guaraná Antarctica':       '/api/storage/objects/uploads/19483f43-e4f2-44bf-b4af-982841aa0058',
  'Sprite':                   '/api/storage/objects/uploads/f6a98179-4c1a-4974-bd88-257d687e29be',
  // M&Ms stored with literal & in DB (not URL-encoded)
  'Pizza M&Ms':               '/api/storage/objects/uploads/dc35e70c-a0f1-4386-a5ce-24b1e64a6ddb',
  'Pizza Campera':            '/api/storage/objects/uploads/5907a7d2-a02b-45d2-ac60-e76e88c428ab',
  'Pizza Frango Catupiry':    '/api/storage/objects/uploads/b94f4374-a64f-46ce-96b0-285657c155c6',
  'Pizza La Mafia':           '/api/storage/objects/uploads/d6563762-5f86-44e8-83dd-4fb37fa601b7',
  'Pizza Pepperoni':          '/api/storage/objects/uploads/7f2db96e-99ef-4069-a5f3-920f26b3c207',
};

export async function runImageUrlMigration(): Promise<void> {
  // Check if any row still has the old Supabase URL
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM menu_items WHERE image_url LIKE '%supabase.co%'`
  );
  const stale = parseInt(rows[0]?.count ?? '0', 10);
  if (stale === 0) return; // already migrated, skip

  logger.info({ stale }, 'Running image URL migration: replacing Supabase URLs');

  const names = Object.keys(SUPABASE_TO_OBJECT_STORAGE);
  const setClauses = names.map(
    (name, i) => `WHEN $${i * 2 + 1} THEN $${i * 2 + 2}`
  );
  const params: string[] = [];
  for (const name of names) {
    params.push(name, SUPABASE_TO_OBJECT_STORAGE[name]);
  }
  const nameParams = names.map((_, i) => `$${i * 2 + 1}`).join(', ');

  const sql = `
    UPDATE menu_items
    SET image_url = CASE name
      ${setClauses.join('\n      ')}
      ELSE image_url
    END
    WHERE name IN (${nameParams})
      AND image_url LIKE '%supabase.co%'
  `;

  const result = await pool.query(sql, params);
  logger.info({ updated: result.rowCount }, 'Image URL migration complete');
}
