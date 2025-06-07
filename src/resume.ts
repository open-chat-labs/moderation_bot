import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy, updatePolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";

export async function resume(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const policy = await loadPolicy(client.scope);
  policy.moderating = true;
  await updatePolicy(client.scope, policy);
  return ephemeralResponse(client, "Moderation has been resumed in this chat");
}
