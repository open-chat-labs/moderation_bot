import { BotClient, ChatActionScope } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { topOffendersQuery, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";

export async function topOffenders(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const offenders = await withPool(() =>
    topOffendersQuery(client.scope as ChatActionScope)
  );
  return ephemeralResponse(
    client,
    offenders
      .map((o) => {
        return `@UserId(${o.senderId})  **${o.count}**`;
      })
      .join("\n")
  );
}
