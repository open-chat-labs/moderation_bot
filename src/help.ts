import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { schema } from "./definition";
import { ephemeralResponse } from "./helpers";

export async function help(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return ephemeralResponse(client, buildHelpText(), true);
}

function buildHelpText() {
  const definition = schema();
  const lines = definition.commands.map((c) => {
    return `\`/${c.name}\`: ${c.description}`;
  });
  return lines.join("\n");
}
