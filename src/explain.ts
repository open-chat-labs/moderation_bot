import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadModerationEvent } from "./firebase";
import { ephemeralResponse } from "./helpers";

export async function explain(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const messageId = client.stringArg("message_id");
  const reason = await loadModerationEvent(
    client.scope,
    messageId ? BigInt(messageId) : 0n
  );
  return ephemeralResponse(
    client,
    reason
      ? reason
      : "Sorry but I could not find any explanation for this message"
  );
}
