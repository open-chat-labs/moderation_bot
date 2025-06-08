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
      msgs.push(detectionClause(policy));
      msgs.push(consequenceClause(policy));
      msgs.push("Use the `/pause` command to pause moderation of this chat.");
    }
  }
  return ephemeralResponse(client, msgs.join("\n\n"));
}

function detectionClause(policy: Policy): string {
  switch (policy.detection.kind) {
    case "platform":
      return `I am moderating messages in this chat against the platform rules with a threshold of ${policy.threshold}.`;
    case "platform_and_chat":
      return `I am moderating messages in this chat against the platform rules with a threshold of ${policy.threshold} and the chat rules.`;
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
