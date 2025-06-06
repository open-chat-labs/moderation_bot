import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";

export async function stop(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return ephemeralResponse(client, "stopped moderating");
}
