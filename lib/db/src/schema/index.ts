import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_name: text("customer_name").notNull().default(""),
  customer_phone: text("customer_phone").notNull().default(""),
  customer_address: text("customer_address").default(""),
  customer_notes: text("customer_notes").default(""),
  items: jsonb("items").default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0"),
  delivery_fee: numeric("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  tip: numeric("tip", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).default("0"),
  order_type: text("order_type").default("delivery"),
  pickup_time: text("pickup_time").default(""),
  delivery_distance_km: numeric("delivery_distance_km", { precision: 8, scale: 2 }),
  payment_method: text("payment_method").default(""),
  status: text("status").notNull().default("pending"),
  stripe_session_id: text("stripe_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  refunded_at: timestamp("refunded_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const menuItemsTable = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default(""),
  description: text("description").default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  category: text("category").default(""),
  available: boolean("available").default(true),
  sort_order: integer("sort_order").default(0),
  image_url: text("image_url").default(""),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const storeSettingsTable = pgTable("store_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  store_open: boolean("store_open").default(true),
  singleton_key: text("singleton_key").default("main").unique(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const deliverySettingsTable = pgTable("delivery_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: text("mode").default("manual"),
  manual_active: boolean("manual_active").default(true),
  schedule: jsonb("schedule").default({}),
  pickup_active: boolean("pickup_active").default(true),
  singleton_key: text("singleton_key").default("main").unique(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const reservationsTable = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_name: text("customer_name").notNull().default(""),
  customer_phone: text("customer_phone").default(""),
  guests: integer("guests").default(1),
  desired_date: text("desired_date").default(""),
  desired_time: text("desired_time").default(""),
  message: text("message").default(""),
  status: text("status").default("pending"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
