/**
 * This is an express middleware to create an instance of the OpenChat BotClient
 * which can be used for the duration of a single request to interact with the OpenChat backend.
 * See the readme for more explanation.
 */
import {
    BadRequest,
    BotClient,
    BotClientFactory,
    Message,
} from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { match } from "path-to-regexp";
import { MessageLocation } from "./types";

export function withBotClient(
    event: APIGatewayProxyEventV2,
    fn: (client: BotClient) => Promise<APIGatewayProxyResultV2>,
) {
    const jwt = event.headers["x-oc-jwt"];
    if (!jwt) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Missing x-oc-jwt header" }),
        };
    }
    const client = createCommandChatClient(jwt);
    return fn(client);
}

export function badRequest(msg: BadRequest) {
    return {
        statusCode: 400,
        body: msg,
    };
}

export function success(msg: Message) {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: msg?.toResponse(),
        }),
    };
}

function botClientFactory(): BotClientFactory {
    return new BotClientFactory({
        openchatPublicKey: process.env.OC_PUBLIC!,
        icHost: process.env.IC_HOST!,
        identityPrivateKey: process.env.IDENTITY_PRIVATE!,
        openStorageCanisterId: process.env.STORAGE_INDEX_CANISTER!,
    });
}

export function createCommandChatClient(token: string): BotClient {
    const factory = botClientFactory();
    const client = factory.createClientFromCommandJwt(token as string);
    console.log("Bot client created");
    return client;
}

export async function ephemeralResponse(
    client: BotClient,
    txt: string,
    blm: boolean = false,
) {
    const msg = (await client.createTextMessage(txt))
        .makeEphemeral()
        .setBlockLevelMarkdown(blm);
    return success(msg);
}

const groupMessageMatch = match(
    "/chats/group/:groupId/:messageIndex{/:threadIndex}",
);

const channelMessageMatch = match(
    "/community/:communityId/channel/:channelId/:messageIndex{/:threadIndex}",
);

export function extractMessageLocation(
    url: string,
): MessageLocation | undefined {
    try {
        const { pathname } = new URL(url);

        // Use || instead of ?? because path-to-regexp returns false (not null/undefined) for no match
        const urlMatch =
            groupMessageMatch(pathname) || channelMessageMatch(pathname);

        if (urlMatch) {
            const { messageIndex, threadIndex } = urlMatch.params;
            return {
                messageIndex: Number(messageIndex),
                ...(threadIndex && { threadIndex: Number(threadIndex) }),
            };
        }
    } catch (err) {
        console.log("Error parsing message url", err);
    }
    return undefined;
}
