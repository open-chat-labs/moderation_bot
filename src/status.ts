import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";

export async function status(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  // TODO problem - this will currently report that it is moderating private channels
  // when actually it is not. Not sure what to do about private channels in general.
  const policy = await loadPolicy(client.scope);
  let msg = "";
  switch (policy.moderating) {
    case false:
      msg =
        "I am not currently moderating messages in this chat. Use the `/resume` command to resume moderation.";
      break;
    case true: {
      switch (policy.detection.kind) {
        case "platform":
          msg =
            "I am moderating messages in this chat against the platform rules.";
          break;
        case "platform_and_chat":
          msg =
            "I am moderating messages in this chat against the platform rules and the chat rules.";
          break;
      }
      msg += "\n\nUse the `/pause` command to pause moderation of this chat.";
    }
  }
  return ephemeralResponse(client, msg);
}
