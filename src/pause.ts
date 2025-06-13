import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { pauseModeration, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";

export async function pause(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  await withPool(() => pauseModeration(client.scope));
  return ephemeralResponse(client, "Moderation has been paused in this chat");
}
