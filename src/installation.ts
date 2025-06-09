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
  // TODO when we uninstall it would be good to be able to delete all relevant policies
  // not sure we have the right data structure for that at the moment
  await saveUninstall(location);
}
