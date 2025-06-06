import {
  InstallationLocation,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import { saveInstall, saveUninstall } from "./firebase";

export async function install(
  location: InstallationLocation,
  record: InstallationRecord
): Promise<void> {
  await saveInstall(location, record);
}

export async function uninstall(location: InstallationLocation): Promise<void> {
  await saveUninstall(location);
}
