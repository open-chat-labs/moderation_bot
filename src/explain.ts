import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadModerationReason, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";
import { inPublicChat } from "./policy";

export async function explain(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return inPublicChat(client, async () => {
    const messageId = client.stringArg("message_id");
    const reason = await withPool(() =>
      loadModerationReason(client.scope, messageId ? BigInt(messageId) : 0n)
    );
    return ephemeralResponse(
      client,
      reason
        ? reason
        : "Sorry but I could not find any explanation for this message"
    );
  });
}
