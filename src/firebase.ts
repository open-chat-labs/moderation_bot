import { InstallationRegistry } from "@open-ic/openchat-botclient-ts";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  DocumentSnapshot,
  getFirestore,
  Transaction,
} from "firebase-admin/firestore";
import { State } from "./types";

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

export async function withState(fn: (s: State) => Promise<void>) {
  await withTransaction(async (tx) => {
    const state = await readAll(tx);
    try {
      await fn(state);
    } finally {
      writeAll(tx, state);
    }
  });
}

export async function withTransaction(fn: (tx: Transaction) => Promise<void>) {
  await db.runTransaction(fn);
}

export async function writeAll(tx: Transaction, state: State) {
  writeInstallationRegistry(tx, state.installs.toMap());
  return Promise.resolve();
}

function writeInstallationRegistry(
  tx: Transaction,
  installs: Map<string, string>
): void {
  try {
    const docRef = db
      .collection(`/${process.env.FIREBASE_COLLECTION!}`)
      .doc("installation_registry");
    const dataObject: { [key: string]: string } = {};
    for (const [k, v] of installs) {
      dataObject[k] = v;
    }
    tx.set(docRef, dataObject);
  } catch (error) {
    console.error(`Error writing installation_registry:`, error);
    throw error;
  }
}

export async function readAll(tx: Transaction): Promise<State> {
  const collection = db.collection(`/${process.env.FIREBASE_COLLECTION!}`);
  const installsDoc = collection.doc("installation_registry");
  const [installsSnap] = await tx.getAll(installsDoc);

  return {
    installs: InstallationRegistry.fromMap(mapInstallData(installsSnap)),
  };
}

function mapInstallData(doc: DocumentSnapshot): Map<string, string> {
  if (!doc.exists) {
    console.log("installation_registry document not found");
    return new Map();
  }

  const data = doc.data();

  // Check if the retrieved data is an object and contains only string values
  if (typeof data !== "object" || data === null) {
    console.error("Firestore data is not an object:", data);
    return new Map();
  }

  const result = new Map<string, string>();

  for (const key in data) {
    const value = data[key];
    if (typeof value === "string") {
      result.set(key, value);
    }
  }

  return result;
}
