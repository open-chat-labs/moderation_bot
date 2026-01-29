import {
    BotClient,
    ChatActionScope,
    ChatEventsCriteria,
    MessageEvent,
} from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import {
    getInstallation,
    hasUserReported,
    saveMessageReport,
    withPool,
    withTransaction,
} from "./db/database";
import { factory } from "./factory";
import { ephemeralResponse, extractMessageLocation } from "./helpers";
import { moderateMessage } from "./moderate";
import { inPublicChat } from "./policy";

async function createAutonomousClient(
    client: BotClient,
): Promise<BotClient | undefined> {
    // We don't actually want to use the client derived from the command context because we
    // want reports to be anonymous. This means that we need to create an autonomous context client
    const installation = await withTransaction((tx) =>
        getInstallation(tx, client.scope as ChatActionScope),
    );
    if (installation === undefined) return undefined;

    return factory.createClientInAutonomouseContext(
        client.scope,
        installation.apiGateway,
        installation.grantedAutonomousPermissions,
    );
}

export async function report(
    client: BotClient,
): Promise<APIGatewayProxyResultV2> {
    const url = client.stringArg("message_url");
    if (url === undefined) {
        return ephemeralResponse(
            client,
            "You must supply the url of the message that you want to report",
        );
    }

    const messageLocation = extractMessageLocation(url);
    if (messageLocation === undefined) {
        return ephemeralResponse(
            client,
            "The url you provided doesn't look like a message url to me. Use the context menu on the message you want to report and choose 'Copy message url'.",
        );
    }

    const autonomousClient = await createAutonomousClient(client);
    if (autonomousClient === undefined) {
        return ephemeralResponse(
            client,
            "The bot does not appear to be installed in this context",
        );
    }

    return inPublicChat(autonomousClient, async () => {
        let threadRootMessageIndex = messageLocation.threadIndex
            ? messageLocation.messageIndex
            : undefined;
        let responseMessage =
            "The message has been reported for moderation. Action will be taken if necessary.";
        const args: ChatEventsCriteria = {
            kind: "chat_events_window",
            midPointMessageIndex:
                messageLocation.threadIndex ?? messageLocation.messageIndex,
            maxMessages: 1,
            maxEvents: 1,
        };
        const resp = await autonomousClient.chatEvents(
            args,
            threadRootMessageIndex,
        );
        if (resp.kind === "success") {
            const ev = resp.events[0];
            if (ev !== undefined && ev.event.kind === "message") {
                const messageId = ev.event.messageId;
                const initiator = client.initiator;
                if (initiator === undefined) {
                    return ephemeralResponse(
                        autonomousClient,
                        "Unable to identify reporter",
                    );
                }
                await withPool(async () => {
                    const scope = autonomousClient.scope as ChatActionScope;
                    const alreadyReported = await hasUserReported(
                        scope,
                        messageId,
                        initiator,
                    );

                    if (alreadyReported) {
                        responseMessage =
                            "You have already reported this message";
                        return;
                    }

                    await saveMessageReport(scope, messageId, initiator);

                    const result = await moderateMessage(
                        autonomousClient,
                        ev.index,
                        ev.event as MessageEvent,
                        threadRootMessageIndex,
                        true,
                    );

                    if (result.kind === "already_moderated") {
                        responseMessage =
                            "This message has already been moderated but your report has been noted";
                    }
                });
            } else {
                responseMessage =
                    "Requested message is not of the expected type";
            }
        } else {
            responseMessage = "Unable to load the requested message";
        }
        return ephemeralResponse(autonomousClient, responseMessage);
    });
}
