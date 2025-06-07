import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy, updatePolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";

export async function pause(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const policy = await loadPolicy(client.scope);
  policy.moderating = false;
  await updatePolicy(client.scope, policy);
  return ephemeralResponse(client, "Moderation has been paused in this chat");
}
