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
  lines.push(
    "\nI check messages against each line of your chat rules. Start with reactions (`/action`) before letting me delete, because a message can try to talk me out of flagging it."
  );
  return lines.join("\n");
}
