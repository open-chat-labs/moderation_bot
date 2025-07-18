import {
  ActionScope,
  BotClient,
  ChatActionScope,
  CommunityIdentifier,
  ImageContent,
  MessageContent,
  MessageEvent,
} from "@open-ic/openchat-botclient-ts";
import OpenAI from "openai";
import { getPolicy, saveModerationEvent } from "./db/database";
import {
  Action,
  CategoryViolation,
  defaultPolicy,
  Explanation,
  Moderated,
  Moderation,
  Policy,
  Rules,
} from "./types";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const systemPrompt = `
You are a rule-based chat moderation assistant.

Your job is to decide whether a message should be allowed, based solely on:
- The provided chat rules
- The message type (text, image, video, etc.)
- The context (chat or thread)
- The message content

Instructions:
- Only enforce what's *explicitly* in the rules.
- Do not interpret, assume, or generalise.
- Do not apply moral, ethical, or safety judgements unless clearly stated in a rule.
- If a rule doesn’t apply directly, allow the message.

Examples:
- If rules ban dog content, but the message doesn’t mention dogs — allow it.
- If the message is abusive, but no rule bans abuse — allow it.
- If media is banned in chat, but this is an image in a thread — allow it.

When in doubt, allow the message.

Output format (JSON):
{
  "allowed": true | false,
  "reason": "short explanation of your decision"
}
`;

const userMessage = (
  ctx: string,
  rules: string[],
  hint: string,
  txt?: string
) => `
Chat moderation rules: ${rules.join("\n\n")}
Message: 
- Type: ${hint}
- Context: ${ctx}
- Content: ${txt}
`;

async function askOpenAI(
  rules: string[],
  message: string | undefined,
  contentHint: string,
  scope: ActionScope,
  messageId: bigint,
  eventIndex: number,
  messageIndex: number,
  senderId: string,
  thread?: number
): Promise<Moderation> {
  const msg = userMessage(
    thread ? "Thread (not chat)" : "Chat (not thread)",
    rules,
    contentHint,
    message
  );
  const prompt: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: msg,
        },
      ],
      temperature: 0,
    };
  const completion = await openai.chat.completions.create(prompt);
  if (completion.choices[0].message.content !== undefined) {
    const json = JSON.parse(completion.choices[0].message.content as string);
    if (json.allowed) {
      return { kind: "not_moderated" };
    } else {
      return {
        kind: "moderated",
        reason: json.reason,
        scope,
        messageId,
        eventIndex,
        messageIndex,
        senderId,
      };
    }
  }
  return { kind: "not_moderated" };
}

function buildImageUrl(content: ImageContent): string | undefined {
  if (content.blobReference) {
    return `https://${content.blobReference?.canisterId}.raw.icp0.io/blobs/${content.blobReference?.blobId}`;
  }
}

// It is quite common for chat rules to forbid certain types of message in the main chat but allow
// it in a thread
function extractFromContent(
  content: MessageContent
): [string | undefined, string, string | undefined] | undefined {
  switch (content.kind) {
    case "audio_content":
      return [content.caption, "Audio message", undefined];
    case "video_content":
      return [content.caption, "Video message", undefined];
    case "crypto_content":
      return [content.caption, "Crypto transfer", undefined];
    case "file_content":
      return [content.caption, "File message", undefined];
    case "giphy_content":
      return [content.caption, "Gif message", undefined];
    case "image_content":
      return [content.caption, "Image message", buildImageUrl(content)];
    case "p2p_swap_content":
      return [content.caption, "Swap message", undefined];
    case "poll_content":
      return [content.config.text, "Poll message", undefined];
    case "prize_content":
      return [content.caption, "Prize message", undefined];
    case "text_content":
      return [content.text, "Text message", undefined];
    default:
      return undefined;
  }
}

export async function moderateMessage(
  client: BotClient,
  index: number,
  event: MessageEvent,
  thread?: number
): Promise<void> {
  const policy =
    (await getPolicy(client.scope as ChatActionScope)) ?? defaultPolicy;
  if (!policy.moderating) {
    console.log("Skipping message as policy.moderating is set to false");
    return;
  }

  const fromTheBot = event.sender === process.env.BOT_ID!;
  if (fromTheBot) {
    console.log("Message came from the moderator bot - skipping");
    return;
  }

  const messageId = event.messageId;
  const messageIndex = event.messageIndex;
  const eventIndex = index;
  const senderId = event.sender;
  const content = extractFromContent(event.content);

  if (content !== undefined) {
    const [txt, hint, imageUrl] = content;

    let result: Moderation = { kind: "not_moderated" };
    if (policy.rules !== Rules.CHAT_RULES && txt !== undefined) {
      result = await generalModeration(
        client,
        policy,
        txt,
        imageUrl,
        messageId,
        eventIndex,
        messageIndex,
        senderId
      );
    }
    if (result.kind === "not_moderated") {
      if (policy.rules !== Rules.GENERAL_RULES) {
        result = await chatModerate(
          client,
          txt,
          hint,
          messageId,
          eventIndex,
          messageIndex,
          senderId,
          thread
        );
      }
    }

    if (result.kind === "moderated") {
      await messageBreaksTheRules(client, policy, result, thread);
    }
  }
}

function categoriesThatBreakThreshold(
  threshold: number,
  scores: OpenAI.Moderation.CategoryScores
): CategoryViolation[] {
  const violating: CategoryViolation[] = [];
  for (const [cat, score] of Object.entries(scores)) {
    if (score >= threshold) {
      violating.push({ category: cat, score: Number(score) });
    }
  }
  return violating;
}

function summariseViolations(violations: CategoryViolation[]): string {
  const msgs: string[] = [
    "Message flagged against the following categories:\n",
  ];
  violations.forEach((v) => {
    msgs.push(`${v.category} (${v.score.toFixed(2)})`);
  });
  return msgs.join("\n");
}

export async function generalModeration(
  client: BotClient,
  policy: Policy,
  text: string,
  imageUrl: string | undefined,
  messageId: bigint,
  eventIndex: number,
  messageIndex: number,
  senderId: string
): Promise<Moderation> {
  console.log("Message text: ", text);

  const inputs: OpenAI.ModerationMultiModalInput[] = [{ type: "text", text }];
  if (imageUrl !== undefined) {
    inputs.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const moderation = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: inputs,
  });
  if (moderation.results.length > 0) {
    const result = moderation.results[0];
    const breaking = categoriesThatBreakThreshold(
      policy.threshold,
      result.category_scores
    );
    if (breaking.length > 0) {
      console.log("Moderation result: ", moderation.results);
      return {
        kind: "moderated",
        messageId,
        eventIndex,
        messageIndex,
        scope: client.scope,
        reason: summariseViolations(breaking),
        senderId,
      };
    }
    return { kind: "not_moderated" };
  }
  return { kind: "not_moderated" };
}

async function getRules(client: BotClient): Promise<string[]> {
  const promises: Promise<string>[] = [];
  const scope = client.scope;
  if (scope.isChatScope()) {
    if (scope.chat.isChannel()) {
      promises.push(
        client
          .communitySummary(new CommunityIdentifier(scope.chat.communityId))
          .then((resp) => {
            if (resp.kind === "community_summary" && resp.rules.enabled) {
              return resp.rules.text;
            }
            return "";
          })
      );
    }
    promises.push(
      client.chatSummary().then((resp) => {
        if (resp.kind === "group_chat" && resp.rules.enabled) {
          return resp.rules.text;
        }
        return "";
      })
    );
  }
  const result = await Promise.all(promises);
  return result.filter((r) => r !== "");
}

export async function chatModerate(
  client: BotClient,
  text: string | undefined,
  contentHint: string,
  messageId: bigint,
  eventIndex: number,
  messageIndex: number,
  senderId: string,
  thread?: number
): Promise<Moderation> {
  const rules = await getRules(client);
  if (rules.length > 0) {
    const result = await askOpenAI(
      rules,
      text,
      contentHint,
      client.scope,
      messageId,
      eventIndex,
      messageIndex,
      senderId,
      thread
    );
    return result;
  }
  return Promise.resolve({ kind: "not_moderated" });
}

async function applyExplanationStrategy(
  client: BotClient,
  policy: Policy,
  moderated: Moderated,
  thread?: number
) {
  await saveModerationEvent(moderated);
  switch (policy.explanation) {
    case Explanation.QUOTE_REPLY: {
      const msg = await client.createTextMessage(moderated.reason);
      msg.setRepliesTo(moderated.eventIndex);
      if (thread !== undefined) {
        msg.setThread(thread);
      }
      await client.sendMessage(msg).then((resp) => {
        if (resp.kind === "error") {
          console.log("Sending reply failed with: ", resp);
        }
        return resp;
      });
      break;
    }
    case Explanation.THREAD_REPLY:
      const msg = await client.createTextMessage(moderated.reason);
      msg.setFinalised(true);
      if (thread !== undefined) {
        msg.setRepliesTo(moderated.eventIndex).setThread(thread);
      } else {
        msg.setThread(moderated.messageIndex);
      }
      await client.sendMessage(msg).then((resp) => {
        if (resp.kind === "error") {
          console.log("Sending reply failed with: ", resp);
        }
      });
      break;
  }
}

async function messageBreaksTheRules(
  client: BotClient,
  policy: Policy,
  moderated: Moderated,
  thread?: number
) {
  await applyExplanationStrategy(client, policy, moderated, thread);
  switch (policy.action) {
    case Action.REACTION:
      {
        const resp = await client
          .addReaction(moderated.messageId, policy.reaction ?? "💩", thread)
          .catch((err) => console.error("Error reacting to message", err));
        if (resp?.kind !== "success") {
          console.error("Error reacting to message: ", resp);
        }
      }
      break;
    case Action.DELETION:
      {
        const resp = await client
          .deleteMessages([moderated.messageId], thread)
          .catch((err) => console.error("Error deleting message", err));
        if (resp?.kind !== "success") {
          console.error("Error deleting message: ", resp);
        }
      }
      break;
  }
}
