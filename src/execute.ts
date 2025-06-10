import { commandNotFound } from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { action, explanation, rules, threshold } from "./configure";
import { explain } from "./explain";
import { help } from "./help";
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
      case "rules":
        return rules(client);
      case "action":
        return action(client);
      case "threshold":
        return threshold(client);
      case "explain":
        return explain(client);
      case "explanation":
        return explanation(client);
      case "help":
        return help(client);
      default:
        return badRequest(commandNotFound());
    }
  });
};
