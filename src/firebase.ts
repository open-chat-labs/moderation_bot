import {
  InstallationLocation,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Transaction } from "firebase-admin/firestore";

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

function serialiseLocation(location: InstallationLocation): string {
  return Buffer.from(JSON.stringify(location)).toString("base64url");
}

export async function withTransaction(fn: (tx: Transaction) => Promise<void>) {
  await db.runTransaction(fn);
}

export async function saveUninstall(location: InstallationLocation) {
  const docRef = db
    .collection("installations")
    .doc(serialiseLocation(location));

  await docRef.delete();
}

export async function saveInstall(
  location: InstallationLocation,
  record: InstallationRecord
) {
  const docRef = db
    .collection("installations")
    .doc(serialiseLocation(location));

  await docRef.set({
    apiGateway: record.apiGateway,
    grantedCommandPermissions: record.grantedCommandPermissions.rawPermissions,
    grantedAutonomousPermissions:
      record.grantedAutonomousPermissions.rawPermissions,
  });
}
