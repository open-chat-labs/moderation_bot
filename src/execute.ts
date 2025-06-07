import { commandNotFound } from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { configure } from "./configure";
import { badRequest, withBotClient } from "./helpers";
import { pause } from "./pause";
import { resume } from "./resume";
import { status } from "./status";

export const command: APIGatewayProxyHandlerV2 = async (event) => {
  return withBotClient(event, async (client) => {
    switch (client.commandName) {
      case "resume":
        return resume(client);
      case "pause":
        return pause(client);
      case "status":
        return status(client);
      case "configure":
        return configure(client);
      default:
        return badRequest(commandNotFound());
    }
  });
};
