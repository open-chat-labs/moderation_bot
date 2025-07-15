import { BotClient, ChatActionScope } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { getPolicy, withPool } from "./db/database";
import { ephemeralResponse } from "./helpers";
import { defaultPolicy, Policy } from "./types";

export async function getPolicyIfPublic(
  client: BotClient
): Promise<Policy | undefined> {
  const [policy, chat] = await Promise.all([
    withPool(() => getPolicy(client.scope as ChatActionScope)),
    client.chatSummary(),
  ]);

  // if we cannot determine that the chat is public then assume we are not operating in this context
  if (chat.kind === "direct_chat" || chat.kind === "error" || !chat.isPublic)
    return undefined;

  // otherwise return either the explicity or default policy for public contexts
  return policy ?? defaultPolicy;
}

async function chatIsPublic(client: BotClient): Promise<boolean> {
  const chat = await client.chatSummary();
  return chat.kind === "group_chat" && chat.isPublic;
}

export async function inPublicChat(
  client: BotClient,
  fn: () => Promise<APIGatewayProxyResultV2>
): Promise<APIGatewayProxyResultV2> {
  const isPublic = await chatIsPublic(client);
  if (!isPublic) {
    return sorry(client);
  }
  return fn();
}

export async function withPolicy(
  client: BotClient,
  fn: (policy: Policy) => Promise<APIGatewayProxyResultV2>
): Promise<APIGatewayProxyResultV2> {
  const policy = await getPolicyIfPublic(client);
  if (policy === undefined) {
    return sorry(client);
  }
  return fn(policy);
}

function sorry(client: BotClient) {
  return ephemeralResponse(
    client,
    "I am sorry but I cannot operate in private chats at the moment.",
    true
  );
}
