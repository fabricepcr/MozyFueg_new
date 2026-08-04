import { db } from '@/lib/db';

/**
 * Checks if the store is open and accepting orders.
 * Reads from the store_settings table via the supabase proxy.
 * Returns true if open, false if closed.
 */
export async function isStoreOpen() {
  try {
    const records = await db.select('store_settings');
    if (!records || records.length === 0) return true; // Default: open
    // Use the most recently updated record
    const sorted = [...records].sort(
      (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    );
    return sorted[0].store_open === true;
  } catch {
    return true; // Default to open on error
  }
}
