import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { resumeModeration, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";

export async function resume(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  await withPool(() => resumeModeration(client.scope));
  return ephemeralResponse(client, "Moderation has been resumed in this chat");
}
