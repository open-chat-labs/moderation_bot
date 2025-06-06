import {
  BotClient,
  BotEvent,
  handleNotification,
} from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { factory } from "./factory";
import { chatModerate, platformModerate } from "./moderate";
import { ModeratableContent } from "./types";

export const notify: APIGatewayProxyHandlerV2 = async (event) => {
  const resp = (await handleNotification(
    event.body,
    factory,
    async (client: BotClient, ev: BotEvent) => {
      if (ev.kind === "bot_chat_event" && ev.eventType === "message") {
        const eventIndex = ev.eventIndex;
        const resp = await client.chatEvents({
          kind: "chat_events_by_index",
          eventIndexes: [eventIndex],
        });
        if (
          resp.kind === "success" &&
          resp.events[0].event.kind === "message" &&
          (resp.events[0].event.content.kind === "text_content" ||
            resp.events[0].event.content.kind === "image_content")
        ) {
          const message = resp.events[0].event as ModeratableContent;
          let breaksChatRules = false;
          const breaksPlatformRules = await platformModerate(client, message);
          if (!breaksPlatformRules) {
            breaksChatRules = await chatModerate(client, message);
          }
          if (breaksPlatformRules) {
            console.log("Message broke platform rules: ", message.messageId);
          }
          if (breaksChatRules) {
            console.log("Message broke chat rules: ", message.messageId);
          }
        }
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
