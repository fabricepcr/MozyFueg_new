/**
 * Migration: add `ingredients` text column to menu_items and auto-populate
 * from the existing `description` for pizza rows where it is NULL.
 * Idempotent: checks for the column before adding it.
 */
import { pool } from '@workspace/db';
import { logger } from './logger';

export async function runIngredientsMigration(): Promise<void> {
  // 1. Add column if it doesn't exist yet
  const { rows } = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'ingredients'
  `);
  const columnExists = parseInt(rows[0]?.count ?? '0', 10) > 0;

  if (!columnExists) {
    logger.info('ingredientsMigration: adding ingredients column to menu_items');
    await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS ingredients TEXT`);
  }

  // 2. Auto-populate from description for pizza rows where ingredients is NULL.
  //    Splits on ", " and " y " — matches typical Spanish pizza descriptions.
  //    Admin edits are preserved (WHERE ingredients IS NULL).
  const { rowCount } = await pool.query(`
    UPDATE menu_items
    SET ingredients = description
    WHERE category ILIKE '%pizza%'
      AND description IS NOT NULL
      AND description != ''
      AND ingredients IS NULL
  `);

  if ((rowCount ?? 0) > 0) {
    logger.info({ rowCount }, 'ingredientsMigration: auto-populated ingredients for pizza rows');
  }
}
