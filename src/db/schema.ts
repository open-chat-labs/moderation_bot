import {
  boolean,
  foreignKey,
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
  location: text().primaryKey().notNull(),
  apiGateway: text("api_gateway").notNull(),
  commandPermissions: json("command_permissions").notNull(),
  autonomousPermissions: json("autonomous_permissions").notNull(),
});

export const senderViolations = pgTable(
  "sender_violations",
  {
    scope: text().notNull(),
    messageId: numeric("message_id").notNull(),
    senderId: text().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.scope, table.messageId, table.senderId],
      name: "sender_violation_pk",
    }),
    foreignKey({
      columns: [table.scope, table.messageId],
      foreignColumns: [moderationEvents.scope, moderationEvents.messageId],
      name: "moderation_fk",
    }).onDelete("cascade"),
  ]
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    scope: text().notNull(),
    messageId: numeric("message_id").notNull(),
    eventIndex: integer("event_index").notNull(),
    messageIndex: integer("message_index").notNull(),
    reason: text().notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.scope, table.messageId],
      name: "moderation_pk",
    }),
  ]
);

export const policy = pgTable(
  "policy",
  {
    location: text().notNull(),
    scope: text().notNull(),
    moderating: boolean().notNull(),
    threshold: real().notNull(),
    explanation: smallint().notNull(),
    rules: smallint().notNull(),
    action: smallint().notNull(),
    reaction: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.location],
      foreignColumns: [installations.location],
      name: "location_fk",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.location, table.scope], name: "policy_pk" }),
  ]
);
