import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";

export async function configure(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const moderating = client.booleanArg("moderating");
  const detectionMode = client.stringArg("detectionMode");
  const customRules = client.stringArg("customRules");
  const consquence = client.stringArg("consequence");
  const reaction = client.stringArg("reaction");

  // should we prepare for full configurability by
  // adding all the category threshold sliders
  // Nah

  return ephemeralResponse(
    client,
    "set the config for the moderation in this scope"
  );
}
