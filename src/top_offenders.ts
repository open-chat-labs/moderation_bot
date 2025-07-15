import { BotClient, ChatActionScope } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { topOffendersQuery, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";
import { inPublicChat } from "./policy";

export async function topOffenders(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  return inPublicChat(client, async () => {
    const offenders = await withPool(() =>
      topOffendersQuery(client.scope as ChatActionScope)
    );
    const msg =
      offenders.length === 0
        ? "Everyone seems to be behaving themselves impeccably here 😇"
        : offenders
            .map((o) => {
              return `@UserId(${o.senderId})  **${o.count}**`;
            })
            .join("\n");
    return ephemeralResponse(client, msg);
  });
}
