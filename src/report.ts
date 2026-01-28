import {
    BotClient,
    ChatEventsCriteria,
    MessageEvent,
} from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";
import { moderateMessage } from "./moderate";
import { inPublicChat } from "./policy";

function extractMessageIndex(url: string): number | undefined {
    try {
        const { pathname } = new URL(url);
        const segments = pathname.split("/").filter(Boolean);
        const lastSegment = segments.at(-1);

        if (!lastSegment) return undefined;

        const index = Number(lastSegment);
        return Number.isInteger(index) ? index : undefined;
    } catch {
        // Invalid URL
        return undefined;
    }
}

export async function report(
    client: BotClient,
): Promise<APIGatewayProxyResultV2> {
    const url = client.stringArg("message_url");
    console.log("Reporting url: ", url);
    if (url === undefined) {
        return ephemeralResponse(
            client,
            "You must supply the url of the message that you want to report",
        );
    }

    const messageIndex = extractMessageIndex(url);

    console.log("Extracted messageIndex: ", messageIndex);

    if (messageIndex === undefined) {
        return ephemeralResponse(
            client,
            "I was unable to extract the message index from the message url",
        );
    }

    return inPublicChat(client, async () => {
        let responseMessage =
            "The message has been reported for moderation. Action will be taken if necessary.";
        const threadIndex: bigint | undefined = undefined;
        const args: ChatEventsCriteria = {
            kind: "chat_events_window",
            midPointMessageIndex: messageIndex,
            maxMessages: 1,
            maxEvents: 1,
        };
        console.log("Getting the relevant event from OC", args);
        const resp = await client.chatEvents(args, threadIndex);
        console.log("Got the relevant event from OC", JSON.stringify(resp));
        if (resp.kind === "success") {
            const ev = resp.events[0];
            if (ev !== undefined && ev.event.kind === "message") {
                console.log("About to moderate the message");
                await withPool(() =>
                    moderateMessage(
                        client,
                        ev.index,
                        ev.event as MessageEvent,
                        threadIndex,
                        true,
                    ),
                );
            } else {
                responseMessage =
                    "Requested message is not of the expected type";
            }
        } else {
            responseMessage = "Unable to load the requested message";
        }
        return ephemeralResponse(client, responseMessage);
    });
}
