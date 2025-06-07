import { BotClient } from "@open-ic/openchat-botclient-ts";
import OpenAI from "openai";
import { loadPolicy } from "./firebase";
import { ModeratableContent, Policy } from "./types";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function askOpenAI(rules: string, message: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          'You are a moderator for a chat platform. Your task is to assess whether a message violates a given set of chat rules. Use only the provided rules. Do not apply any other critieria. Respond only with "Yes" or "No". "Yes" if if violates the rules, "No" if it does not. Do not explain or justify your answer.',
      },
      {
        role: "user",
        content: `Chat Rules:\n${rules}\n\nMessage:\n"${message}"\n\nDoes this message violate the chat rules? Yes or No?`,
      },
    ],
    temperature: 0,
  });
  return completion.choices[0].message.content;
}

export async function moderateMessage(
  client: BotClient,
  eventIndex: number
): Promise<void> {
  const policy = await loadPolicy(client.scope);
  if (!policy.moderating) {
    console.log("Skipping message as policy.moderating is set to false");
    return;
  }

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
      if (policy.detection.kind === "platform_and_chat") {
        breaksChatRules = await chatModerate(client, message);
      }
    }
    if (breaksPlatformRules) {
      console.log("Message broke platform rules: ", message.messageId);
    }
    if (breaksChatRules) {
      console.log("Message broke chat rules: ", message.messageId);
    }
    if (breaksPlatformRules || breaksChatRules) {
      await messageBreaksTheRules(policy, client, message.messageId);
    }
  }
}

export async function platformModerate(
  client: BotClient,
  message: ModeratableContent
): Promise<boolean> {
  // we *should* be able to moderate images as well but it's a bit tricky in dev environment
  if (message.content.kind === "image_content") return Promise.resolve(false);

  const moderation = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: message.content.text,
  });
  if (moderation.results.length > 0) {
    const result = moderation.results[0];
    if (result.flagged) {
      console.log("Moderation API result: ", result);
    }
    return result.flagged;
  }
  return Promise.resolve(false);
}

export async function chatModerate(
  client: BotClient,
  message: ModeratableContent
): Promise<boolean> {
  if (message.content.kind === "image_content") return false;

  const summary = await client.chatSummary();
  if (summary.kind === "group_chat" && summary.rules.enabled) {
    const answer = await askOpenAI(summary.rules.text, message.content.text);
    return answer === "Yes";
  }
  return Promise.resolve(false);
}

async function messageBreaksTheRules(
  policy: Policy,
  client: BotClient,
  messageId: bigint
) {
  switch (policy.consequence.kind) {
    case "reaction":
      {
        const resp = await client
          .addReaction(messageId, policy.consequence.reaction)
          .catch((err) => console.error("Error reacting to message", err));
        if (resp?.kind !== "success") {
          console.error("Error reacting to message: ", resp);
        }
      }
      break;
    case "deletion":
      {
        const resp = await client
          .deleteMessages([messageId])
          .catch((err) => console.error("Error deleting message", err));
        if (resp?.kind !== "success") {
          console.error("Error deleting message: ", resp);
        }
      }
      break;
  }
}
