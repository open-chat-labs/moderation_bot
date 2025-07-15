import { BotClient, ChatActionScope } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { resumeModeration, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";
import { inPublicChat } from "./policy";

export async function resume(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return inPublicChat(client, async () => {
    await withPool(() => resumeModeration(client.scope as ChatActionScope));
    return ephemeralResponse(
      client,
      "Moderation has been resumed in this chat"
    );
  });
}
