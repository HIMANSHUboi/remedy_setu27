import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const remedyProductCategoryEnum = pgEnum("remedy_product_category", [
  "GEMSTONE",
  "RUDRAKSHA",
  "SPIRITUAL_PRODUCT",
  "PUJA_SERVICE",
]);

export const remedyLeadIntentEnum = pgEnum("remedy_lead_intent", [
  "PRICE_ENQUIRY",
  "BULK_ORDER",
  "AVAILABILITY",
  "COMPLAINT",
  "GENERAL_QUERY",
]);

export const remedyLeadStatusEnum = pgEnum("remedy_lead_status", ["NEW", "REPLIED", "CONVERTED"]);

export const remedyProducts = pgTable("remedy_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  hindiName: text("hindi_name").notNull(),
  category: remedyProductCategoryEnum("category").notNull(),
  unit: text("unit").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
  tier10PlusPrice: numeric("tier10_plus_price", { precision: 12, scale: 2 }),
  tier50PlusPrice: numeric("tier50_plus_price", { precision: 12, scale: 2 }),
  tier100PlusPrice: numeric("tier100_plus_price", { precision: 12, scale: 2 }),
  inStock: boolean("in_stock").notNull().default(true),
  description: text("description").notNull(),
});

export const remedyLeads = pgTable(
  "remedy_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerMessage: text("customer_message").notNull(),
    detectedLanguage: text("detected_language").notNull(),
    intent: remedyLeadIntentEnum("intent").notNull(),
    matchedProductId: uuid("matched_product_id").references(() => remedyProducts.id, {
      onDelete: "set null",
    }),
    extractedQuantity: integer("extracted_quantity").notNull().default(1),
    quotedTotal: numeric("quoted_total", { precision: 12, scale: 2 }),
    suggestedReply: text("suggested_reply").notNull(),
    status: remedyLeadStatusEnum("status").notNull().default("NEW"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => [
    index("remedy_leads_created_at_idx").on(table.createdAt),
    index("remedy_leads_intent_idx").on(table.intent),
    check("remedy_leads_extracted_quantity_check", sql`${table.extractedQuantity} > 0`),
  ],
);
