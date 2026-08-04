import { base44 } from '@/api/base44Client';

/**
 * Checks if the store is open and accepting orders.
 * Always reads the most recently updated record from the DB.
 * Returns true if open, false if closed.
 */
export async function isStoreOpen() {
  const records = await base44.entities.StoreSettings.list('-updated_date', 1);
  if (!records || records.length === 0) return true; // Default: open
  return records[0].store_open === true;
}