import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";
import { getChatRules } from "./moderate";
import { withPolicy } from "./policy";
import { createAutonomousClient } from "./report";
import { Rule, sourceLabel } from "./rules";
import { Action, Explanation, Policy } from "./types";

export async function status(
    client: BotClient,
): Promise<APIGatewayProxyResultV2> {
    return withPolicy(client, async (policy) => {
        // The command client can't be granted community permissions in a group install, so read
        // the rules with the autonomous client, which is what moderation itself uses
        const autonomousClient = await createAutonomousClient(client);
        const rules = await getChatRules(autonomousClient ?? client);
        let msgs: string[] = [];
        if (!policy.moderating) {
            msgs.push(
                "I am not currently moderating messages in this chat. Use the `/resume` command to resume moderation.",
            );
            msgs.push(
                "You may still use the `/report` command to request ad hoc moderation on a specific message with the following policy:",
            );
        }
        msgs.push(rulesClause(rules));
        msgs.push(
            "* Higher threshold values make me more permissive.\n" +
                progressBar(policy.threshold),
        );
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

function rulesClause(rules: Rule[]): string {
    if (rules.length === 0) {
        return "* This chat has no rules enabled, so there is nothing for me to check. Add rules in the chat settings and I will start checking messages against them.";
    }
    const list = rules
        .map((r) => `* ${sourceLabel(r.source)} rule: ${r.text}`)
        .join("\n");
    return `* Messages will be checked against each of these rules:\n\n${list}`;
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
