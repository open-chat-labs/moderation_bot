import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy, updatePolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";
import { Explanation, RulesMode } from "./types";

export async function explanation(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const explanation = client.stringArg("explanation");
  const policy = await loadPolicy(client.scope);
  policy.explanation = explanation as Explanation;
  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The moderation explanation strategy in this chat has been updated."
  );
}

export async function rules(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const rules = client.stringArg("rules");
  const policy = await loadPolicy(client.scope);
  policy.rules = { kind: rules as RulesMode["kind"] };
  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The moderation rules in this chat have been updated."
  );
}

export async function action(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const actionMode = client.stringArg("action");
  const reaction = client.stringArg("reaction");
  const policy = await loadPolicy(client.scope);
  policy.action =
    actionMode === "deletion"
      ? { kind: "deletion" }
      : { kind: "reaction", reaction: reaction ?? "💩" };

  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The moderation action in this chat has been updated."
  );
}

export async function threshold(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const threshold = client.decimalArg("threshold") ?? 0.8;
  const policy = await loadPolicy(client.scope);
  policy.threshold = threshold;
  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The  moderation threshold in this chat has been updated."
  );
}
