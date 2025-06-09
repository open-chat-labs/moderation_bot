import {
  BotClient,
  BotEvent,
  handleNotification,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { factory } from "./factory";
import { install, uninstall } from "./installation";
import { moderateMessage } from "./moderate";

export const notify: APIGatewayProxyHandlerV2 = async (event) => {
  const resp = (await handleNotification(
    event.body,
    factory,
    async (client: BotClient, ev: BotEvent, apiGateway: string) => {
      if (ev.kind === "bot_uninstalled_event") {
        await uninstall(ev.location);
        return { statusCode: 200 };
      }

      if (ev.kind === "bot_installed_event") {
        await install(
          ev.location,
          new InstallationRecord(
            apiGateway,
            ev.grantedAutonomousPermissions,
            ev.grantedCommandPermissions
          )
        );
        return { statusCode: 200 };
      }

      if (ev.kind === "bot_chat_event" && ev.eventType === "message") {
        await moderateMessage(client, ev.eventIndex, ev.thread);
      }
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "all good",
        }),
      };
    },
    (error) => ({
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to parse bot event",
        error,
      }),
    })
  )) ?? { statusCode: 200 };

  return resp;
};
