import {
  ActionScope,
  InstallationLocation,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Transaction } from "firebase-admin/firestore";
import { defaultPolicy, Moderated, Policy, PolicySchema } from "./types";

function initFirebaseApp() {
  if (getApps().length > 0) return getApp();

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!json) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(json);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const app = initFirebaseApp();
const db = getFirestore(app);

function keyify(thing: unknown): string {
  return Buffer.from(JSON.stringify(thing)).toString("base64url");
}

export async function withTransaction(fn: (tx: Transaction) => Promise<void>) {
  await db.runTransaction(fn);
}

function mapPolicy(doc: FirebaseFirestore.DocumentSnapshot): Policy {
  const parsed = PolicySchema.safeParse(doc.data());
  if (!parsed.success) {
    console.error("Failed to parse policy doc, returning default policy");
    return defaultPolicy;
  }
  return parsed.data;
}

export async function saveModerationEvent(mod: Moderated) {
  const scopeKey = keyify(mod.scope);
  const key = `${scopeKey}_${mod.messageId}`;
  const docRef = db.collection("moderation_events").doc(key);
  await docRef.set({
    reason: mod.reason,
  });
}

export async function loadModerationEvent(
  scope: ActionScope,
  messageId: bigint
): Promise<string | undefined> {
  const scopeKey = keyify(scope);
  const key = `${scopeKey}_${messageId}`;
  const docRef = db.collection("moderation_events").doc(key);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log("No moderation event found for this scope and messageId", key);
    return undefined;
  }
  const data = doc.data() as { reason: string };
  return data.reason;
}

export async function updatePolicy(scope: ActionScope, policy: Policy) {
  const docRef = db.collection("policy").doc(keyify(scope));
  await docRef.set(policy, { merge: true });
}

export async function loadPolicy(scope: ActionScope): Promise<Policy> {
  const docRef = db.collection("policy").doc(keyify(scope));
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log("No policy found for this scope, returning default policy");
    return defaultPolicy;
  }
  return mapPolicy(doc);
}

export async function saveUninstall(location: InstallationLocation) {
  const docRef = db.collection("installations").doc(keyify(location));

  await docRef.delete();
}

export async function saveInstall(
  location: InstallationLocation,
  record: InstallationRecord
) {
  const docRef = db.collection("installations").doc(keyify(location));

  await docRef.set({
    apiGateway: record.apiGateway,
    grantedCommandPermissions: record.grantedCommandPermissions.rawPermissions,
    grantedAutonomousPermissions:
      record.grantedAutonomousPermissions.rawPermissions,
  });
}
