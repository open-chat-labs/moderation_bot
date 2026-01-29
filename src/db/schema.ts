import {
    boolean,
    foreignKey,
    index,
    integer,
    json,
    numeric,
    pgTable,
    primaryKey,
    real,
    serial,
    smallint,
    text,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";

export const installations = pgTable("installations", {
    location: text().primaryKey().notNull(),
    apiGateway: text("api_gateway").notNull(),
    commandPermissions: json("command_permissions").notNull(),
    autonomousPermissions: json("autonomous_permissions").notNull(),
});

export const messageReports = pgTable(
    "message_reports",
    {
        id: serial("id").primaryKey(),
        scope: text().notNull(),
        messageId: numeric("message_id").notNull(),
        reportedBy: text("reported_by").notNull(),
        reportedAt: timestamp("reported_at", { mode: "string" }).notNull(),
    },
    (table) => [
        unique("unique_report").on(
            table.scope,
            table.messageId,
            table.reportedBy,
        ),
        index("idx_reports_by_message").on(table.scope, table.messageId),
        index("idx_reports_by_user").on(table.reportedBy),
    ],
);

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
            foreignColumns: [
                moderationEvents.scope,
                moderationEvents.messageId,
            ],
            name: "moderation_fk",
        }).onDelete("cascade"),
    ],
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
        source: text().default("automated").notNull(),
    },
    (table) => [
        primaryKey({
            columns: [table.scope, table.messageId],
            name: "moderation_pk",
        }),
    ],
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
        primaryKey({
            columns: [table.location, table.scope],
            name: "policy_pk",
        }),
    ],
);
