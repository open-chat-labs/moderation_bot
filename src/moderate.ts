import {
    BotClient,
    ChatActionScope,
    CommunityIdentifier,
    MessageContent,
    MessageEvent,
} from "@open-ic/openchat-botclient-ts";
import {
    getPolicy,
    hasBeenModerated,
    saveModerationEvent,
} from "./db/database";
import { askJev } from "./jev";
import {
    describeBroken,
    Rule,
    RuleSource,
    splitRules,
    verdict,
} from "./rules";
import {
    Action,
    defaultPolicy,
    Explanation,
    Moderated,
    Moderation,
    Policy,
} from "./types";

// It is quite common for chat rules to forbid certain types of message in the main chat but allow
// it in a thread
function extractFromContent(
    content: MessageContent,
): [string | undefined, string] | undefined {
    switch (content.kind) {
        case "audio_content":
            return [content.caption, "Audio message"];
        case "video_content":
            return [content.caption, "Video message"];
        case "crypto_content":
            return [content.caption, "Crypto transfer"];
        case "file_content":
            return [content.caption, "File message"];
        case "giphy_content":
            return [content.caption, "Gif message"];
        case "image_content":
            return [content.caption, "Image message"];
        case "p2p_swap_content":
            return [content.caption, "Swap message"];
        case "poll_content":
            return [content.config.text, "Poll message"];
        case "prize_content":
            return [content.caption, "Prize message"];
        case "text_content":
            return [content.text, "Text message"];
        default:
            return undefined;
    }
}

export async function moderateMessage(
    client: BotClient,
    index: number,
    event: MessageEvent,
    thread?: number,
    manual?: boolean,
): Promise<Moderation> {
    const scope = client.scope as ChatActionScope;
    const policy = (await getPolicy(scope)) ?? defaultPolicy;
    if (!policy.moderating && !manual) {
        console.log("Skipping message as policy.moderating is set to false");
        return { kind: "not_moderated" };
    }

    const fromTheBot = event.sender === process.env.BOT_ID!;
    if (fromTheBot) {
        console.log("Message came from the moderator bot - skipping");
        return { kind: "not_moderated" };
    }

    const messageId = event.messageId;
    const content = extractFromContent(event.content);

    const alreadyModerated = await hasBeenModerated(scope, messageId);
    if (alreadyModerated) {
        return { kind: "already_moderated" };
    }

    if (content === undefined) {
        return { kind: "not_moderated" };
    }

    const chat = await client.chatSummary();
    if (chat.kind !== "group_chat" || !chat.isPublic) {
        console.log("Chat is not public - skipping");
        return { kind: "not_moderated" };
    }

    const rules = await getChatRules(client);
    if (rules.length === 0) {
        console.log("Chat has no enabled rules - skipping");
        return { kind: "not_moderated" };
    }

    const [txt, hint] = content;
    const answer = await askJev(
        {
            type: hint,
            context: thread !== undefined ? "thread" : "main chat",
            content: txt,
        },
        rules.map((r) => r.text),
    );
    if (answer.kind === "failure") {
        return { kind: "not_moderated" };
    }

    const result = verdict(rules, answer.scores, policy.threshold);
    console.log("Jev verdict:", answer.model, JSON.stringify(result));
    if (result.kind === "not_flagged") {
        return { kind: "not_moderated" };
    }

    const moderated: Moderated = {
        kind: "moderated",
        reason: describeBroken(result.broken),
        scope,
        messageId,
        eventIndex: index,
        messageIndex: event.messageIndex,
        senderId: event.sender,
        source: manual ? "user_report" : "automated",
    };
    await messageBreaksTheRules(client, policy, moderated, thread);
    return moderated;
}

// The enabled rules for this chat, community rules first, split into one rule per line
export async function getChatRules(client: BotClient): Promise<Rule[]> {
    const promises: Promise<{ source: RuleSource; text: string }>[] = [];
    const scope = client.scope;
    if (scope.isChatScope()) {
        const isChannel = scope.chat.isChannel();
        if (isChannel) {
            promises.push(
                client
                    .communitySummary(
                        new CommunityIdentifier(scope.chat.communityId),
                    )
                    .then((resp) => ({
                        source: "community" as const,
                        text:
                            resp.kind === "community_summary" &&
                            resp.rules.enabled
                                ? resp.rules.text
                                : "",
                    })),
            );
        }
        promises.push(
            client.chatSummary().then((resp) => ({
                source: isChannel ? "channel" : "group",
                text:
                    resp.kind === "group_chat" && resp.rules.enabled
                        ? resp.rules.text
                        : "",
            })),
        );
    }
    return splitRules(await Promise.all(promises));
}

function applyExplanationStrategy(
    client: BotClient,
    policy: Policy,
    moderated: Moderated,
    thread?: number,
): Promise<unknown>[] {
    const promises: Promise<unknown>[] = [];
    promises.push(saveModerationEvent(moderated));
    console.log(
        "Applying explanation strategy:",
        policy.explanation,
        "thread:",
        thread,
    );
    switch (policy.explanation) {
        case Explanation.QUOTE_REPLY: {
            console.log("Adding QUOTE_REPLY promise");
            promises.push(
                client
                    .createTextMessage(moderated.reason)
                    .then((msg) => msg.setRepliesTo(moderated.eventIndex))
                    .then((msg) => {
                        if (thread !== undefined) {
                            return msg.setThread(thread);
                        }
                        return msg;
                    })
                    .then((msg) => client.sendMessage(msg)),
            );
            break;
        }
        case Explanation.THREAD_REPLY: {
            console.log(
                "Adding THREAD_REPLY promise, moderated.messageIndex:",
                moderated.messageIndex,
            );
            promises.push(
                client
                    .createTextMessage(moderated.reason)
                    .then((msg) => {
                        console.log("Created text message");
                        return msg.setFinalised(true);
                    })
                    .then((msg) => {
                        console.log("Set finalised, thread:", thread);
                        if (thread !== undefined) {
                            return msg
                                .setRepliesTo(moderated.eventIndex)
                                .setThread(thread);
                        } else {
                            return msg.setThread(moderated.messageIndex);
                        }
                    })
                    .then((msg) => {
                        console.log("About to send thread reply message");
                        return client.sendMessage(msg);
                    })
                    .then((result) => {
                        console.log("Thread reply sent, result:", result);
                        return result;
                    })
                    .catch((err) => {
                        console.error("Error sending thread reply:", err);
                        throw err;
                    }),
            );
            break;
        }
    }
    return promises;
}

async function messageBreaksTheRules(
    client: BotClient,
    policy: Policy,
    moderated: Moderated,
    thread?: number,
) {
    // everything that happens when the message breaks the rules can (and should) be done in parallel to minimise the overall
    // duration (and cost) of the lambda
    try {
        const promises: Promise<unknown>[] = applyExplanationStrategy(
            client,
            policy,
            moderated,
            thread,
        );
        switch (policy.action) {
            case Action.REACTION:
                promises.push(
                    client.addReaction(
                        moderated.messageId,
                        policy.reaction ?? "💩",
                        thread,
                    ),
                );
                break;
            case Action.DELETION:
                promises.push(
                    client.deleteMessages([moderated.messageId], thread),
                );
                break;
        }

        await Promise.all(promises);
    } catch (err) {
        console.error("Error processing moderation violation", err);
    }
}
