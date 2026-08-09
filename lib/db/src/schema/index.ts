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

export const deliveryGuysTable = pgTable("delivery_guys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  active: boolean("active").default(true),
  singleton_key: text("singleton_key"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

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
  scheduled_for: text("scheduled_for").default(""),
  stripe_session_id: text("stripe_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  assigned_driver_id: uuid("assigned_driver_id").references(() => deliveryGuysTable.id, { onDelete: "set null" }),
  refunded_at: timestamp("refunded_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const menuItemsTable = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default(""),
  description: text("description").default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  price_23cm: numeric("price_23cm", { precision: 10, scale: 2 }),
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

export const projetoTasksTable = pgTable("projeto_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  epic_letter: text("epic_letter").notNull(),
  epic_name: text("epic_name").notNull(),
  title: text("title").notNull(),
  scope: text("scope").default(""),
  status: text("status").notNull().default("a_fazer"),
  needs_info: boolean("needs_info").default(false),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const projetoChecklistTable = pgTable("projeto_checklist", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull(),
  text: text("text").notNull(),
  checked: boolean("checked").default(false),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const toppingsTable = pgTable("toppings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  price_full: numeric("price_full", { precision: 10, scale: 2 }).notNull().default("0"),
  price_half: numeric("price_half", { precision: 10, scale: 2 }).notNull().default("0"),
  price_quarter: numeric("price_quarter", { precision: 10, scale: 2 }).notNull().default("0"),
  available: boolean("available").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
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
