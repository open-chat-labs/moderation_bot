import { BotClient, ChatActionScope } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import {
  updateActionPolicy,
  updateExplanationPolicy,
  updateRulesPolicy,
  updateThreshold,
  withPool,
} from "./db/database";
import { ephemeralResponse } from "./helpers";
import { Action, Explanation, Rules } from "./types";

export async function explanation(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const explanation = client.integerArg("explanation") ?? 0n;
  await withPool(() =>
    updateExplanationPolicy(
      client.scope as ChatActionScope,
      explanation as unknown as Explanation
    )
  );
  return ephemeralResponse(
    client,
    "The moderation explanation strategy in this chat has been updated."
  );
}

export async function rules(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const rules = client.integerArg("rules") ?? 0n;
  await withPool(() =>
    updateRulesPolicy(
      client.scope as ChatActionScope,
      rules as unknown as Rules
    )
  );
  return ephemeralResponse(
    client,
    "The moderation rules in this chat have been updated."
  );
}

export async function action(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const actionMode = client.integerArg("action") ?? 0n;
  const reaction = client.stringArg("reaction");
  await withPool(() =>
    updateActionPolicy(
      client.scope as ChatActionScope,
      actionMode as unknown as Action,
      reaction
    )
  );
  return ephemeralResponse(
    client,
    "The moderation action in this chat has been updated."
  );
}

export async function threshold(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  await withPool(() =>
    updateThreshold(
      client.scope as ChatActionScope,
      client.decimalArg("threshold") ?? 0.8
    )
  );
  return ephemeralResponse(
    client,
    "The  moderation threshold in this chat has been updated."
  );
}
