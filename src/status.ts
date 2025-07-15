import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";
import { withPolicy } from "./policy";
import { Action, Explanation, Policy, Rules } from "./types";

export async function status(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return withPolicy(client, (policy) => {
    let msgs: string[] = [];
    switch (policy.moderating) {
      case false:
        msgs.push(
          "I am not currently moderating messages in this chat. Use the `/resume` command to resume moderation."
        );
        break;
      case true: {
        msgs = msgs.concat(rulesClause(policy));
        msgs.push(actionClause(policy));
        msgs.push(explanationClause(policy));
        msgs.push(
          "Use the `/help` command for an overview of the configuration options."
        );
      }
    }
    return ephemeralResponse(client, msgs.join("\n\n"), true);
  });
}

function progressBar(score: number, width = 20): string {
  const filled = Math.round(score * width);
  const empty = width - filled;
  return `\`strict < ${"█".repeat(filled)}${"░".repeat(
    empty
  )} > permissive ${score.toFixed(2)}\``;
}

function rulesClause(policy: Policy): string[] {
  switch (policy.rules) {
    case Rules.CHAT_RULES:
      return [`I am moderating messages in this chat against the chat rules.`];
    case Rules.GENERAL_RULES:
      return [
        `I am moderating messages in this chat against [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications).`,
        "Higher threshold values make me more permissive.",
        progressBar(policy.threshold),
      ];
    case Rules.GENERAL_AND_CHAT_RULES:
      return [
        `I am moderating messages in this chat against both [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications) and the specific chat rules.`,
        "Higher threshold values make me more permissive.",
        progressBar(policy.threshold),
      ];
  }
}

function actionClause(policy: Policy): string {
  switch (policy.action) {
    case Action.DELETION:
      return "I will automatically delete messages that I think break the rules.";
    case Action.REACTION:
      return `I will react to message that I think break the rules with the ${policy.reaction} emoji.`;
  }
}

function explanationClause(policy: Policy): string {
  switch (policy.explanation) {
    case Explanation.NONE:
      return "I will not currently explain my decisions.";
    case Explanation.QUOTE_REPLY:
      return "I will explain my decisions by quote replying to the message.";
    case Explanation.THREAD_REPLY:
      return "I will explain my decisions by replying to the message in a thread.";
  }
}
