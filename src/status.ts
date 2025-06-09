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
      msgs = msgs.concat(detectionClause(policy));
      msgs.push(consequenceClause(policy));
      msgs.push("Use the `/pause` command to pause moderation of this chat.");
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

function detectionClause(policy: Policy): string[] {
  switch (policy.detection.kind) {
    case "chat_rules":
      return [`I am moderating messages in this chat against the chat rules.`];
    case "platform_rules":
      return [
        `I am moderating messages in this chat against the platform rules`,
        "Higher threshold values make me more permissive",
        progressBar(policy.threshold),
        `General rules are evaluated using the [OpenAI standard classification](https://platform.openai.com/docs/guides/moderation#content-classifications).`,
      ];
    case "platform_and_chat_rules":
      return [
        `I am moderating messages in this chat against the platform rules and the chat rules.`,
        "Higher threshold values make me more permissive",
        progressBar(policy.threshold),
        `General rules are evaluated using the [OpenAI standard classification](https://platform.openai.com/docs/guides/moderation#content-classifications).`,
      ];
  }
}

function consequenceClause(policy: Policy): string {
  switch (policy.consequence.kind) {
    case "deletion":
      return "I will automatically delete messages that I think break the rules.";
    case "reaction":
      return `I will react to message that I think break the rules with the ${policy.consequence.reaction} emoji.`;
  }
}
