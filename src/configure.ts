import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { loadPolicy, updatePolicy } from "./firebase";
import { ephemeralResponse } from "./helpers";

export async function configure(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const detectionMode = client.stringArg("detection_mode");
  const consquenceMode = client.stringArg("consequence_mode");
  const reaction = client.stringArg("reaction");
  const policy = await loadPolicy(client.scope);
  policy.detection =
    detectionMode === "platform"
      ? { kind: "platform" }
      : { kind: "platform_and_chat" };
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
