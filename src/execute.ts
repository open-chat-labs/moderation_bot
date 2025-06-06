import { commandNotFound } from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { configure } from "./configure";
import { badRequest, withBotClient } from "./helpers";
import { start } from "./start";
import { status } from "./status";
import { stop } from "./stop";

export const command: APIGatewayProxyHandlerV2 = async (event) => {
  return withBotClient(event, async (client) => {
    switch (client.commandName) {
      case "start":
        return start(client);
      case "stop":
        return stop(client);
      case "status":
        return status(client);
      case "configure":
        return configure(client);
      default:
        return badRequest(commandNotFound());
    }
  });
};
