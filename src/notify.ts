import {
  BotClient,
  BotEvent,
  handleNotification,
  InstallationRecord,
} from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { saveInstallation, uninstall, withPool } from "./db/database";
import { factory } from "./factory";
import { moderateMessage } from "./moderate";

export const notify: APIGatewayProxyHandlerV2 = async (event) => {
  const resp = (await handleNotification(
    event.body,
    factory,
    async (client: BotClient, ev: BotEvent, apiGateway: string) => {
      if (ev.kind === "bot_uninstalled_event") {
        const location = ev.location;
        await withPool(() => uninstall(location));
        return { statusCode: 200 };
      }

      if (ev.kind === "bot_installed_event") {
        const location = ev.location;
        const record = new InstallationRecord(
          apiGateway,
          ev.grantedAutonomousPermissions,
          ev.grantedCommandPermissions
        );
        await withPool(() => saveInstallation(location, record));
        return { statusCode: 200 };
      }

      if (ev.kind === "bot_chat_event" && ev.eventType === "message") {
        await withPool(() => moderateMessage(client, ev.eventIndex, ev.thread));
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
