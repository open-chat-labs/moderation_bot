import {
    BotInstallationEvent,
    InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import {
    deleteInstallation,
    installationKey,
    listInstallationKeys,
    saveInstallation,
    unkeyify,
} from "./db/database";
import { factory } from "./factory";

// Rebuilds the installations table from OpenChat's own record of installs and uninstalls.
// Dry run unless apply is true.
export async function resync(apply = false) {
    const resp = await factory.createGlobalClient().installationEvents();
    if (resp.kind !== "success") {
        throw new Error(`Could not load installation events: ${resp.kind}`);
    }

    const at = (e: BotInstallationEvent) =>
        e.kind === "installed" ? e.installedAt : e.uninstalledAt;
    const latest = new Map<string, BotInstallationEvent>();
    [...resp.events]
        .sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0))
        .forEach((e) => latest.set(installationKey(e.location), e));

    const installed = [...latest.entries()].filter(
        ([, e]) => e.kind === "installed",
    );
    const existing = new Set(await listInstallationKeys());
    const missing = installed.filter(([k]) => !existing.has(k));
    // Only delete where OpenChat says the bot was uninstalled. Rows with no events at all may
    // predate OpenChat's event log, so they are left alone.
    const stale = [...existing].filter(
        (k) => latest.get(k)?.kind === "uninstalled",
    );
    const unknown = [...existing].filter((k) => !latest.has(k));

    console.log(
        `OpenChat events: ${resp.events.length}, installed now: ${installed.length}, rows in db: ${existing.size}`,
    );
    console.log(`Missing from db (${missing.length}):`);
    missing.forEach(([k]) => console.log(`  + ${unkeyify(k)}`));
    console.log(`In db but uninstalled (${stale.length}):`);
    stale.forEach((k) => console.log(`  - ${unkeyify(k)}`));
    console.log(`In db with no OpenChat events, left alone (${unknown.length}):`);
    unknown.forEach((k) => console.log(`  ? ${unkeyify(k)}`));

    if (!apply) {
        console.log("Dry run, nothing written");
        return;
    }

    // Rewrite every current install, not just the missing ones, so permissions are correct
    for (const [, e] of installed) {
        if (e.kind !== "installed") continue;
        await saveInstallation(
            e.location,
            new InstallationRecord(
                e.apiGateway,
                e.grantedCommandPermissions,
                e.grantedAutonomousPermissions,
                e.installedAt,
            ),
        );
    }
    for (const k of stale) {
        await deleteInstallation(k);
    }
    console.log(
        `Wrote ${installed.length} installs, deleted ${stale.length} stale rows`,
    );
}
