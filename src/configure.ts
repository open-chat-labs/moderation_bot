import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy, updatePolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";
import { DetectionMode } from "./types";

export async function rules(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const detectionMode = client.stringArg("strategy");
  const policy = await loadPolicy(client.scope);
  policy.detection = { kind: detectionMode as DetectionMode["kind"] };
  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The configuration for the moderation in this chat has been updated."
  );
}

export async function consequences(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const consquenceMode = client.stringArg("consequence");
  const reaction = client.stringArg("reaction");
  const policy = await loadPolicy(client.scope);
  policy.consequence =
    consquenceMode === "deletion"
      ? { kind: "deletion" }
      : { kind: "reaction", reaction: reaction ?? "💩" };

  await updatePolicy(client.scope, policy);

  return ephemeralResponse(
    client,
    "The configuration for the moderation in this chat has been updated."
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
    "The configuration for the moderation in this chat has been updated."
  );
}
