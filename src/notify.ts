import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  BotClient,
  BotEvent,
  handleNotification,
  InstallationRecord,
  MessageEvent,
} from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2, SQSEvent } from "aws-lambda";
import { saveInstallation, uninstall, withPool } from "./db/database";
import { factory } from "./factory";
import { moderateMessage } from "./moderate";

const sqs = new SQSClient({});

// All notify does now is push the event to SQS. This will then deal with retrying for us
export const notify: APIGatewayProxyHandlerV2 = async (event) => {
  const queueUrl = process.env.MODERATION_QUEUE_URL;

  console.log("About to send message to SQS: ", queueUrl, event.body);

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: event.body!,
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};

export const processModeration: (e: SQSEvent) => Promise<void> = async (
  event: SQSEvent
) => {
  console.log("Received a message from SQS: ", event.Records);
  for (const record of event.Records) {
    await handleNotification(
      record.body,
      factory,
      async (client: BotClient, ev: BotEvent, apiGateway: string) => {
        try {
          console.log("Event received: ", ev);
          if (ev.kind === "bot_uninstalled_event") {
            const location = ev.location;
            await withPool(() => uninstall(location));
            return;
          }

          if (ev.kind === "bot_installed_event") {
            const location = ev.location;
            const record = new InstallationRecord(
              apiGateway,
              ev.grantedAutonomousPermissions,
              ev.grantedCommandPermissions
            );
            await withPool(() => saveInstallation(location, record));
          }

          if (
            ev.kind === "bot_chat_event" &&
            ev.event.kind === "message" &&
            ev.initiatedBy !== process.env.BOT_ID
          ) {
            await withPool(() =>
              moderateMessage(
                client,
                ev.eventIndex,
                ev.event as MessageEvent,
                ev.thread
              )
            );
          }
        } catch (err) {
          console.error("Error handling event from OpenChat: ", err);
          throw err;
        }
      },
      (error) => {
        throw error;
      }
    );
  }
};
