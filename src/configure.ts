import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";

export async function configure(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return ephemeralResponse(
    client,
    "set the config for the moderation in this scope"
  );
}
