import { neonConfig, Pool } from "@neondatabase/serverless";
import {
  ActionScope,
  ChatActionScope,
  chatIdentifierToInstallationLocation,
  InstallationLocation,
  InstallationRecord,
  Permissions,
} from "@open-ic/openchat-botclient-ts";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import {
  Action,
  defaultPolicy,
  Explanation,
  Moderated,
  Policy,
  Rules,
} from "../types";
import * as schema from "./schema";
import { installations } from "./schema";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

export type Tx = Parameters<typeof db.transaction>[0] extends (
  tx: infer T
) => any
  ? T
  : never;

type RawPermissions = {
  chat: number;
  community: number;
  message: number;
};

function updateModerating(scope: ActionScope, moderating: boolean) {
  return db
    .update(schema.policy)
    .set({
      moderating,
    })
    .where(eq(schema.policy.scope, keyify(scope)));
}

export function pauseModeration(scope: ActionScope) {
  return updateModerating(scope, false);
}

export function resumeModeration(scope: ActionScope) {
  return updateModerating(scope, true);
}

export function updateExplanationPolicy(
  scope: ActionScope,
  explanation: Explanation
) {
  return db
    .update(schema.policy)
    .set({
      explanation,
    })
    .where(eq(schema.policy.scope, keyify(scope)));
}

function defaultPolicyRecord(scope: ChatActionScope) {
  const location = chatIdentifierToInstallationLocation(scope.chat);
  const locationKey = keyify(location);
  const scopeKey = keyify(scope);

  return {
    location: locationKey,
    scope: scopeKey,
    moderating: true,
    threshold: 0.8,
    explanation: Explanation.NONE,
    rules: Rules.GENERAL_RULES,
    action: Action.REACTION,
    reaction: "💩",
  };
}

export function updateRulesPolicy(scope: ChatActionScope, rules: Rules) {
  return db
    .insert(schema.policy)
    .values({ ...defaultPolicyRecord(scope), rules })
    .onConflictDoUpdate({
      target: [schema.policy.location, schema.policy.scope],
      set: {
        rules,
      },
    });
}

export function updateThreshold(scope: ActionScope, threshold: number) {
  return db
    .update(schema.policy)
    .set({
      threshold,
    })
    .where(eq(schema.policy.scope, keyify(scope)));
}

export function updateActionPolicy(
  scope: ActionScope,
  action: Action,
  reaction?: string
) {
  return db
    .update(schema.policy)
    .set({
      action,
      reaction: action === Action.REACTION ? reaction ?? "💩" : reaction,
    })
    .where(eq(schema.policy.scope, keyify(scope)));
}

export async function loadModerationReason(
  scope: ActionScope,
  messageId: bigint
) {
  const ev = await db.query.moderationEvents.findFirst({
    where: (i, { eq }) =>
      and(eq(i.scope, keyify(scope)), eq(i.messageId, messageId.toString())),
  });
  return ev?.reason;
}

export function saveModerationEvent(moderated: Moderated) {
  return db
    .insert(schema.moderationEvents)
    .values({
      scope: keyify(moderated.scope),
      messageId: moderated.messageId.toString(),
      eventIndex: moderated.eventIndex,
      messageIndex: moderated.messageIndex,
      reason: moderated.reason,
      timestamp: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

export async function getPolicy(scope: ChatActionScope): Promise<Policy> {
  const location = chatIdentifierToInstallationLocation(scope.chat);
  const locationKey = keyify(location);
  const scopeKey = keyify(scope);

  const policy = await db.query.policy.findFirst({
    where: (i, { eq }) =>
      and(eq(i.location, locationKey), eq(i.scope, scopeKey)),
  });

  return policy
    ? {
        moderating: policy.moderating,
        rules: policy.rules,
        action: policy.action,
        reaction: policy.reaction == null ? undefined : policy.reaction,
        threshold: policy.threshold,
        explanation: policy.explanation,
      }
    : defaultPolicy;
}

export async function getInstallation(
  tx: Tx,
  scope: ChatActionScope
): Promise<InstallationRecord | undefined> {
  const location = chatIdentifierToInstallationLocation(scope.chat);
  const locationKey = keyify(location);

  // check that we are installed in this location
  const install = await tx.query.installations.findFirst({
    where: (i, { eq }) => eq(i.location, locationKey),
  });

  if (install === undefined) return undefined;

  return new InstallationRecord(
    install.apiGateway,
    new Permissions(install.commandPermissions as RawPermissions),
    new Permissions(install.autonomousPermissions as RawPermissions)
  );
}

export async function saveInstallation(
  location: InstallationLocation,
  record: InstallationRecord
) {
  await db
    .insert(schema.installations)
    .values({
      location: keyify(location),
      apiGateway: record.apiGateway,
      autonomousPermissions: record.grantedAutonomousPermissions.rawPermissions,
      commandPermissions: record.grantedCommandPermissions.rawPermissions,
    })
    .onConflictDoUpdate({
      target: schema.installations.location,
      set: {
        autonomousPermissions:
          record.grantedAutonomousPermissions.rawPermissions,
        commandPermissions: record.grantedCommandPermissions.rawPermissions,
      },
    });
}

export async function uninstall(location: InstallationLocation) {
  const key = keyify(location);
  await db.delete(installations).where(eq(installations.location, key));
}

export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    return fn(tx);
  });
}

export async function withPool<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    await pool.end();
  }
}

function keyify(thing: unknown): string {
  return Buffer.from(JSON.stringify(thing)).toString("base64url");
}

export function unkeyify(key: string): string {
  return Buffer.from(key, "base64url").toString("utf8");
}
