import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";

export async function stop(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  // all this is going to do is to update the policy for this scope
  // to set moderating to false
  return ephemeralResponse(client, "stopped moderating");
}
