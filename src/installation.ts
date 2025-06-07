import {
  InstallationLocation,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import { saveInstall, saveUninstall } from "./firebase";

export async function install(
  location: InstallationLocation,
  record: InstallationRecord
): Promise<void> {
  // as soon as we install we should start getting events
  // and we will start moderating immediately with the default
  // config

  // if we receive a message we will look up the config for the
  // scope - if there isn't one we will apply the default config
  // if there is one we use it.
  await saveInstall(location, record);
}

export async function uninstall(location: InstallationLocation): Promise<void> {
  await saveUninstall(location);
}
