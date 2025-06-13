import {
  boolean,
  integer,
  json,
  numeric,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const installations = pgTable("installations", {
  location: text("location").primaryKey(),
  api_gateway: text("api_gateway").notNull(),
  commandPermissions: json("command_permissions").notNull(),
  autonomousPermissions: json("autonomous_permissions").notNull(),
});

export const policy = pgTable(
  "policy",
  {
    location: text("location")
      .notNull()
      .references(() => installations.location),
    scope: text("scope").notNull(),
    moderating: boolean("moderating").notNull(),
    threshold: real("threshold").notNull(),
    explanation: smallint("explanation").notNull(),
    rules: smallint("rules").notNull(),
    action: smallint("action").notNull(),
    reaction: text("reaction"),
  },
  (table) => [
    primaryKey({ name: "policy_pk", columns: [table.location, table.scope] }),
  ]
);

export const moderation_events = pgTable(
  "moderation_events",
  {
    scope: text("scope").notNull(),
    message_id: numeric("message_id").notNull(),
    event_index: integer("event_index").notNull(),
    message_index: integer("message_index").notNull(),
    reason: text("reason").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => [
    primaryKey({
      name: "moderation_pk",
      columns: [table.scope, table.message_id],
    }),
  ]
);
