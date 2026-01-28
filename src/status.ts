import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";
import { withPolicy } from "./policy";
import { Action, Explanation, Policy, Rules } from "./types";

export async function status(
    client: BotClient,
): Promise<APIGatewayProxyResultV2> {
    return withPolicy(client, (policy) => {
        let msgs: string[] = [];
        if (!policy.moderating) {
            msgs.push(
                "I am not currently moderating messages in this chat. Use the `/resume` command to resume moderation.",
            );
            msgs.push(
                "You may still use the `/report` command to request ad hoc moderation on a specific message with the following policy:",
            );
        }
        msgs = msgs.concat(rulesClause(policy));
        msgs.push(actionClause(policy));
        msgs.push(explanationClause(policy));
        msgs.push(
            "Use the `/help` command for an overview of the configuration options.",
        );
        return ephemeralResponse(client, msgs.join("\n\n"), true);
    });
}

function progressBar(score: number, width = 20): string {
    const filled = Math.round(score * width);
    const empty = width - filled;
    return `\`strict < ${"█".repeat(filled)}${"░".repeat(
        empty,
    )} > permissive ${score.toFixed(2)}\``;
}

function rulesClause(policy: Policy): string[] {
    switch (policy.rules) {
        case Rules.CHAT_RULES:
            return [`* Messages will be moderated against the chat rules.`];
        case Rules.GENERAL_RULES:
            return [
                `* Messages in this chat will be moderated against [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications).`,
                "* Higher threshold values make me more permissive.",
                progressBar(policy.threshold),
            ];
        case Rules.GENERAL_AND_CHAT_RULES:
            return [
                `* Messages in this chat will be moderated against both [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications) and the specific chat rules.`,
                "* Higher threshold values make me more permissive.",
                progressBar(policy.threshold),
            ];
    }
}

function actionClause(policy: Policy): string {
    switch (policy.action) {
        case Action.DELETION:
            return "* Messages that break the rules will be automatically deleted";
        case Action.REACTION:
            return `* Messages that break the rules will be tagged with the ${policy.reaction} emoji.`;
    }
}

function explanationClause(policy: Policy): string {
    switch (policy.explanation) {
        case Explanation.NONE:
            return "* Moderation decisions will not be explained";
        case Explanation.QUOTE_REPLY:
            return "* Moderation decisions will be explained by quote reply to the message.";
        case Explanation.THREAD_REPLY:
            return "* Moderation decisions will be explained by replying to the message in a thread.";
    }
}
