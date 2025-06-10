import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";
import { Policy } from "./types";

export async function status(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  // TODO problem - this will currently report that it is moderating private channels
  // when actually it is not. Not sure what to do about private channels in general.
  const policy = await loadPolicy(client.scope);
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
}

function progressBar(score: number, width = 20): string {
  const filled = Math.round(score * width);
  const empty = width - filled;
  return `\`strict < ${"█".repeat(filled)}${"░".repeat(
    empty
  )} > permissive ${score.toFixed(2)}\``;
}

function rulesClause(policy: Policy): string[] {
  switch (policy.rules.kind) {
    case "chat_rules":
      return [`I am moderating messages in this chat against the chat rules.`];
    case "general_rules":
      return [
        `I am moderating messages in this chat against [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications).`,
        "Higher threshold values make me more permissive.",
        progressBar(policy.threshold),
      ];
    case "general_and_chat_rules":
      return [
        `I am moderating messages in this chat against both [general content standards](https://platform.openai.com/docs/guides/moderation#content-classifications) and the specific chat rules.`,
        "Higher threshold values make me more permissive.",
        progressBar(policy.threshold),
      ];
  }
}

function actionClause(policy: Policy): string {
  switch (policy.action.kind) {
    case "deletion":
      return "I will automatically delete messages that I think break the rules.";
    case "reaction":
      return `I will react to message that I think break the rules with the ${policy.action.reaction} emoji.`;
  }
}

function explanationClause(policy: Policy): string {
  switch (policy.explanation) {
    case "none":
      return "I will not currently explain my decisions.";
    case "quote_reply":
      return "I will explain my decisions by quote replying to the message.";
    case "thread_reply":
      return "I will explain my decisions by replying to the message in a thread.";
  }
}
