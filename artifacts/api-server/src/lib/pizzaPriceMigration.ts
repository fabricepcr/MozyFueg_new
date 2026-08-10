/**
 * Startup migration: populate price_23cm (24cm price) for pizzas where it is
 * still NULL. Only fills missing values — admin edits are never overwritten.
 */
import { pool } from '@workspace/db';
import { logger } from './logger';

export async function runPizzaPriceMigration(): Promise<void> {
  // Only run if at least one pizza is still missing its 24cm price
  const { rows } = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count FROM menu_items
    WHERE category IN ('pizzas','pizzas_dulces') AND price_23cm IS NULL
  `);
  const missing = parseInt(rows[0]?.count ?? '0', 10);
  if (missing === 0) return;

  logger.info({ missing }, 'Running pizza 24cm price migration');

  await pool.query(`
    UPDATE menu_items SET
      price_23cm = CASE name
        WHEN 'Pizza Strogonoff'         THEN 13.90
        WHEN 'Pizza Cuatro Quesos'      THEN 9.90
        WHEN 'Pizza Amsterdam'          THEN 13.90
        WHEN 'Pizza Argentina'          THEN 13.90
        WHEN 'Pizza Carioca'            THEN 11.90
        WHEN 'Pizza Granjera'           THEN 10.90
        WHEN 'Pizza Campera'            THEN 13.90
        WHEN 'Pizza Calabresa'          THEN 13.90
        WHEN 'Pizza Del Chef'           THEN 14.90
        WHEN 'Pizza La Mafia'           THEN 11.90
        WHEN 'Pizza Hawaiana Fuego'     THEN 9.90
        WHEN 'Pizza Mafiosa'            THEN 13.90
        WHEN 'Pizza Marguerita'         THEN 8.90
        WHEN 'Pizza Mozzarella'         THEN 9.90
        WHEN 'Pizza Portuguesa'         THEN 11.90
        WHEN 'Pizza Tomate Seco'        THEN 9.90
        WHEN 'Pizza Calabresa Especial' THEN 14.90
        WHEN 'Pizza Vegetariana'        THEN 9.90
        WHEN 'Pizza Crujiente'          THEN 13.90
        WHEN 'Pizza Ruffles'            THEN 11.90
        WHEN 'Pizza Pizzaiolo'          THEN 13.90
        WHEN 'Pizza Pepperoni'          THEN 9.90
        WHEN 'Pizza Carnívora'          THEN 12.90
        WHEN 'Pizza Putanesca'          THEN 10.90
        WHEN 'Pizza Atún'               THEN 10.90
        WHEN 'Pizza Ibérica'            THEN 11.90
        WHEN 'Pizza Funghi'             THEN 10.90
        WHEN 'Pizza Catalana'           THEN 9.90
        WHEN 'Pizza Barbacoa'           THEN 11.90
        WHEN 'Pizza Frango Catupiry'    THEN 13.90
        WHEN 'Pizza Caprese'            THEN 9.90
        WHEN 'Pizza Doritos'            THEN 12.90
        WHEN 'Pizza Piña Nevada'        THEN 11.90
        WHEN 'Pizza Dubai'              THEN 13.90
        WHEN 'Pizza Sensación'          THEN 12.90
        WHEN 'Pizza Uva Trufada'        THEN 12.90
        WHEN 'Pizza M&Ms'               THEN 13.90
        WHEN 'Pizza Banana y Canela'    THEN 7.90
        ELSE price_23cm
      END,
      updated_at = NOW()
    WHERE category IN ('pizzas','pizzas_dulces')
      AND price_23cm IS NULL
  `);

  logger.info('Pizza 24cm price migration complete');
}
