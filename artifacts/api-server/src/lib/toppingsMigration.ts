/**
 * One-time migration: add 5 size-specific price columns to toppings table
 * and populate from the 2026-08 pricing sheet.
 * Idempotent: checks if price_full_33cm column already exists.
 */
import { pool } from '@workspace/db';
import { logger } from './logger';

export async function runToppingsPriceMigration(): Promise<void> {
  // Check if columns already added
  const { rows } = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.columns
    WHERE table_name = 'toppings' AND column_name = 'price_full_33cm'
  `);
  const alreadyDone = parseInt(rows[0]?.count ?? '0', 10) > 0;

  if (!alreadyDone) {
    logger.info('Running toppings migration: adding size-specific price columns');
    await pool.query(`
      ALTER TABLE toppings
        ADD COLUMN IF NOT EXISTS price_full_33cm   NUMERIC,
        ADD COLUMN IF NOT EXISTS price_half_33cm   NUMERIC,
        ADD COLUMN IF NOT EXISTS price_quarter_33cm NUMERIC,
        ADD COLUMN IF NOT EXISTS price_full_24cm   NUMERIC,
        ADD COLUMN IF NOT EXISTS price_half_24cm   NUMERIC
    `);
  }

  // Rename Ternera → Tiras de ternera if still present
  await pool.query(
    `UPDATE toppings SET name = 'Tiras de ternera', updated_at = NOW() WHERE name = 'Ternera'`
  );

  // Populate / refresh all 5 price columns from the 2026-08 sheet
  await pool.query(`
    UPDATE toppings SET
      price_full_33cm    = CASE name
        WHEN 'Aceitunas negras'     THEN 2.00  WHEN 'Aceitunas verdes'     THEN 2.00
        WHEN 'Atún'                 THEN 3.00  WHEN 'Bacon'                THEN 4.00
        WHEN 'Cebolla caramelizada' THEN 2.50  WHEN 'Cebolla morada'       THEN 2.00
        WHEN 'Champiñones'          THEN 3.00  WHEN 'Cheddar'              THEN 3.00
        WHEN 'Chorizo ibérico'      THEN 4.00  WHEN 'Gorgonzola'           THEN 3.00
        WHEN 'Huevo cocido'         THEN 3.00  WHEN 'Jamón dulce'          THEN 3.00
        WHEN 'Maíz dulce'           THEN 2.00  WHEN 'Mozzarella extra'     THEN 3.00
        WHEN 'Pepperoni'            THEN 3.00  WHEN 'Pimiento verde'       THEN 2.00
        WHEN 'Piña'                 THEN 2.00  WHEN 'Pollo'                THEN 5.00
        WHEN 'Provolone'            THEN 3.00  WHEN 'Rúcula'               THEN 2.00
        WHEN 'Salsa barbacoa'       THEN 2.00  WHEN 'Tiras de ternera'     THEN 5.00
        WHEN 'Tomate cherry'        THEN 2.00  WHEN 'Tomate seco'          THEN 3.00
        ELSE price_full_33cm END,
      price_half_33cm    = CASE name
        WHEN 'Aceitunas negras'     THEN 1.00  WHEN 'Aceitunas verdes'     THEN 1.00
        WHEN 'Atún'                 THEN 2.00  WHEN 'Bacon'                THEN 3.00
        WHEN 'Cebolla caramelizada' THEN 1.50  WHEN 'Cebolla morada'       THEN 1.50
        WHEN 'Champiñones'          THEN 2.00  WHEN 'Cheddar'              THEN 2.00
        WHEN 'Chorizo ibérico'      THEN 3.00  WHEN 'Gorgonzola'           THEN 2.00
        WHEN 'Huevo cocido'         THEN 2.00  WHEN 'Jamón dulce'          THEN 2.00
        WHEN 'Maíz dulce'           THEN 1.50  WHEN 'Mozzarella extra'     THEN 2.00
        WHEN 'Pepperoni'            THEN 2.00  WHEN 'Pimiento verde'       THEN 1.50
        WHEN 'Piña'                 THEN 1.50  WHEN 'Pollo'                THEN 3.50
        WHEN 'Provolone'            THEN 2.00  WHEN 'Rúcula'               THEN 1.50
        WHEN 'Salsa barbacoa'       THEN 1.50  WHEN 'Tiras de ternera'     THEN 3.50
        WHEN 'Tomate cherry'        THEN 1.50  WHEN 'Tomate seco'          THEN 2.00
        ELSE price_half_33cm END,
      price_quarter_33cm = CASE name
        WHEN 'Aceitunas negras'     THEN 0.50  WHEN 'Aceitunas verdes'     THEN 0.50
        WHEN 'Atún'                 THEN 1.50  WHEN 'Bacon'                THEN 1.50
        WHEN 'Cebolla caramelizada' THEN 1.00  WHEN 'Cebolla morada'       THEN 1.00
        WHEN 'Champiñones'          THEN 1.00  WHEN 'Cheddar'              THEN 1.00
        WHEN 'Chorizo ibérico'      THEN 1.50  WHEN 'Gorgonzola'           THEN 1.00
        WHEN 'Huevo cocido'         THEN 1.00  WHEN 'Jamón dulce'          THEN 1.00
        WHEN 'Maíz dulce'           THEN 1.00  WHEN 'Mozzarella extra'     THEN 1.50
        WHEN 'Pepperoni'            THEN 1.50  WHEN 'Pimiento verde'       THEN 1.00
        WHEN 'Piña'                 THEN 1.00  WHEN 'Pollo'                THEN 2.00
        WHEN 'Provolone'            THEN 1.50  WHEN 'Rúcula'               THEN 1.00
        WHEN 'Salsa barbacoa'       THEN 1.00  WHEN 'Tiras de ternera'     THEN 2.00
        WHEN 'Tomate cherry'        THEN 1.00  WHEN 'Tomate seco'          THEN 1.50
        ELSE price_quarter_33cm END,
      price_full_24cm    = CASE name
        WHEN 'Aceitunas negras'     THEN 1.50  WHEN 'Aceitunas verdes'     THEN 1.50
        WHEN 'Atún'                 THEN 2.50  WHEN 'Bacon'                THEN 3.00
        WHEN 'Cebolla caramelizada' THEN 2.00  WHEN 'Cebolla morada'       THEN 1.50
        WHEN 'Champiñones'          THEN 2.50  WHEN 'Cheddar'              THEN 2.50
        WHEN 'Chorizo ibérico'      THEN 3.00  WHEN 'Gorgonzola'           THEN 2.50
        WHEN 'Huevo cocido'         THEN 2.50  WHEN 'Jamón dulce'          THEN 2.50
        WHEN 'Maíz dulce'           THEN 1.50  WHEN 'Mozzarella extra'     THEN 2.50
        WHEN 'Pepperoni'            THEN 2.00  WHEN 'Pimiento verde'       THEN 1.50
        WHEN 'Piña'                 THEN 1.50  WHEN 'Pollo'                THEN 3.00
        WHEN 'Provolone'            THEN 2.50  WHEN 'Rúcula'               THEN 1.50
        WHEN 'Salsa barbacoa'       THEN 1.50  WHEN 'Tiras de ternera'     THEN 3.00
        WHEN 'Tomate cherry'        THEN 1.50  WHEN 'Tomate seco'          THEN 2.00
        ELSE price_full_24cm END,
      price_half_24cm    = CASE name
        WHEN 'Aceitunas negras'     THEN 0.80  WHEN 'Aceitunas verdes'     THEN 0.80
        WHEN 'Atún'                 THEN 1.50  WHEN 'Bacon'                THEN 2.00
        WHEN 'Cebolla caramelizada' THEN 1.50  WHEN 'Cebolla morada'       THEN 1.00
        WHEN 'Champiñones'          THEN 1.50  WHEN 'Cheddar'              THEN 1.50
        WHEN 'Chorizo ibérico'      THEN 2.00  WHEN 'Gorgonzola'           THEN 1.50
        WHEN 'Huevo cocido'         THEN 1.50  WHEN 'Jamón dulce'          THEN 1.50
        WHEN 'Maíz dulce'           THEN 1.00  WHEN 'Mozzarella extra'     THEN 1.50
        WHEN 'Pepperoni'            THEN 1.50  WHEN 'Pimiento verde'       THEN 1.00
        WHEN 'Piña'                 THEN 1.00  WHEN 'Pollo'                THEN 2.00
        WHEN 'Provolone'            THEN 1.50  WHEN 'Rúcula'               THEN 1.00
        WHEN 'Salsa barbacoa'       THEN 1.00  WHEN 'Tiras de ternera'     THEN 2.00
        WHEN 'Tomate cherry'        THEN 1.00  WHEN 'Tomate seco'          THEN 1.50
        ELSE price_half_24cm END,
      -- Keep legacy columns in sync (use 33cm full as the generic reference)
      price_full    = CASE name
        WHEN 'Aceitunas negras'     THEN 2.00  WHEN 'Aceitunas verdes'     THEN 2.00
        WHEN 'Atún'                 THEN 3.00  WHEN 'Bacon'                THEN 4.00
        WHEN 'Cebolla caramelizada' THEN 2.50  WHEN 'Cebolla morada'       THEN 2.00
        WHEN 'Champiñones'          THEN 3.00  WHEN 'Cheddar'              THEN 3.00
        WHEN 'Chorizo ibérico'      THEN 4.00  WHEN 'Gorgonzola'           THEN 3.00
        WHEN 'Huevo cocido'         THEN 3.00  WHEN 'Jamón dulce'          THEN 3.00
        WHEN 'Maíz dulce'           THEN 2.00  WHEN 'Mozzarella extra'     THEN 3.00
        WHEN 'Pepperoni'            THEN 3.00  WHEN 'Pimiento verde'       THEN 2.00
        WHEN 'Piña'                 THEN 2.00  WHEN 'Pollo'                THEN 5.00
        WHEN 'Provolone'            THEN 3.00  WHEN 'Rúcula'               THEN 2.00
        WHEN 'Salsa barbacoa'       THEN 2.00  WHEN 'Tiras de ternera'     THEN 5.00
        WHEN 'Tomate cherry'        THEN 2.00  WHEN 'Tomate seco'          THEN 3.00
        ELSE price_full END,
      price_half    = CASE name
        WHEN 'Aceitunas negras'     THEN 1.00  WHEN 'Aceitunas verdes'     THEN 1.00
        WHEN 'Atún'                 THEN 2.00  WHEN 'Bacon'                THEN 3.00
        WHEN 'Cebolla caramelizada' THEN 1.50  WHEN 'Cebolla morada'       THEN 1.50
        WHEN 'Champiñones'          THEN 2.00  WHEN 'Cheddar'              THEN 2.00
        WHEN 'Chorizo ibérico'      THEN 3.00  WHEN 'Gorgonzola'           THEN 2.00
        WHEN 'Huevo cocido'         THEN 2.00  WHEN 'Jamón dulce'          THEN 2.00
        WHEN 'Maíz dulce'           THEN 1.50  WHEN 'Mozzarella extra'     THEN 2.00
        WHEN 'Pepperoni'            THEN 2.00  WHEN 'Pimiento verde'       THEN 1.50
        WHEN 'Piña'                 THEN 1.50  WHEN 'Pollo'                THEN 3.50
        WHEN 'Provolone'            THEN 2.00  WHEN 'Rúcula'               THEN 1.50
        WHEN 'Salsa barbacoa'       THEN 1.50  WHEN 'Tiras de ternera'     THEN 3.50
        WHEN 'Tomate cherry'        THEN 1.50  WHEN 'Tomate seco'          THEN 2.00
        ELSE price_half END,
      price_quarter = CASE name
        WHEN 'Aceitunas negras'     THEN 0.50  WHEN 'Aceitunas verdes'     THEN 0.50
        WHEN 'Atún'                 THEN 1.50  WHEN 'Bacon'                THEN 1.50
        WHEN 'Cebolla caramelizada' THEN 1.00  WHEN 'Cebolla morada'       THEN 1.00
        WHEN 'Champiñones'          THEN 1.00  WHEN 'Cheddar'              THEN 1.00
        WHEN 'Chorizo ibérico'      THEN 1.50  WHEN 'Gorgonzola'           THEN 1.00
        WHEN 'Huevo cocido'         THEN 1.00  WHEN 'Jamón dulce'          THEN 1.00
        WHEN 'Maíz dulce'           THEN 1.00  WHEN 'Mozzarella extra'     THEN 1.50
        WHEN 'Pepperoni'            THEN 1.50  WHEN 'Pimiento verde'       THEN 1.00
        WHEN 'Piña'                 THEN 1.00  WHEN 'Pollo'                THEN 2.00
        WHEN 'Provolone'            THEN 1.50  WHEN 'Rúcula'               THEN 1.00
        WHEN 'Salsa barbacoa'       THEN 1.00  WHEN 'Tiras de ternera'     THEN 2.00
        WHEN 'Tomate cherry'        THEN 1.00  WHEN 'Tomate seco'          THEN 1.50
        ELSE price_quarter END,
      updated_at = NOW()
    WHERE name IN (
      'Aceitunas negras','Aceitunas verdes','Atún','Bacon',
      'Cebolla caramelizada','Cebolla morada','Champiñones','Cheddar',
      'Chorizo ibérico','Gorgonzola','Huevo cocido','Jamón dulce',
      'Maíz dulce','Mozzarella extra','Pepperoni','Pimiento verde',
      'Piña','Pollo','Provolone','Rúcula','Salsa barbacoa',
      'Tiras de ternera','Tomate cherry','Tomate seco'
    )
  `);

  if (!alreadyDone) {
    logger.info('Toppings migration complete');
  }
}
