import {
  ActionScope,
  BotClient,
  MessageContent,
} from "@open-ic/openchat-botclient-ts";
import OpenAI from "openai";
import { loadPolicy, saveModerationEvent } from "./firebase";
import { CategoryViolation, Moderated, Moderation, Policy } from "./types";
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
  rules: string,
  hint: string,
  txt?: string
) => `
Chat moderation rules: ${rules}
Message: 
- Type: ${hint}
- Context: ${ctx}
- Content: ${txt}
`;

async function askOpenAI(
  rules: string,
  message: string | undefined,
  contentHint: string,
  scope: ActionScope,
  messageId: bigint,
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
      return { kind: "moderated", reason: json.reason, scope, messageId };
    }
  }
  return { kind: "not_moderated" };
}

// It is quite common for chat rules to forbid certain types of message in the main chat but allow
// it in a thread
function extractFromContent(
  content: MessageContent
): [string | undefined, string] | undefined {
  switch (content.kind) {
    case "audio_content":
      return [content.caption, "Audio message"];
    case "video_content":
      return [content.caption, "Video message"];
    case "crypto_content":
      return [content.caption, "Crypto transfer"];
    case "file_content":
      return [content.caption, "File message"];
    case "giphy_content":
      return [content.caption, "Gif message"];
    case "image_content":
      return [content.caption, "Image message"];
    case "p2p_swap_content":
      return [content.caption, "Swap message"];
    case "poll_content":
      return [content.config.text, "Poll message"];
    case "prize_content":
      return [content.caption, "Prize message"];
    case "text_content":
      return [content.text, "Text message"];
    default:
      return undefined;
  }
}

export async function moderateMessage(
  client: BotClient,
  eventIndex: number,
  thread?: number
): Promise<void> {
  const policy = await loadPolicy(client.scope);
  if (!policy.moderating) {
    console.log("Skipping message as policy.moderating is set to false");
    return;
  }

  console.log("Thread: ", thread);
  const resp = await client.chatEvents(
    {
      kind: "chat_events_by_index",
      eventIndexes: [eventIndex],
    },
    thread
  );
  if (resp.kind === "success" && resp.events[0].event.kind === "message") {
    const contentType: MessageContent["kind"] =
      resp.events[0].event.content.kind;
    const messageId = resp.events[0].event.messageId;
    const content = extractFromContent(resp.events[0].event.content);
    if (content !== undefined) {
      const [txt, hint] = content;

      let result: Moderation = { kind: "not_moderated" };
      if (policy.detection.kind !== "chat_rules" && txt !== undefined) {
        result = await platformModerate(client, policy, txt, messageId);
      }
      if (result.kind === "not_moderated") {
        if (policy.detection.kind !== "platform_rules") {
          result = await chatModerate(client, txt, hint, messageId, thread);
        }
      }

      console.log("Moderation result: ", result);
      if (result.kind === "moderated") {
        await messageBreaksTheRules(client, policy, result, thread);
      }
    }
  }
}

function categoriesThatBreakThreshold(
  threshold: number,
  scores: OpenAI.Moderation.CategoryScores
): CategoryViolation[] {
  const scoreValues = [
    scores.harassment,
    scores["harassment/threatening"],
    scores.hate,
    scores["hate/threatening"],
    scores.illicit,
    scores["illicit/violent"],
    scores["self-harm"],
    scores["self-harm/instructions"],
    scores["self-harm/intent"],
    scores.sexual,
    scores["sexual/minors"],
    scores.violence,
    scores["violence/graphic"],
  ];
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
    "The message crossed the moderation threshold for the following categories:\n",
  ];
  violations.forEach((v) => {
    msgs.push(`${v.category} (${v.score})`);
  });
  return msgs.join("\n");
}

export async function platformModerate(
  client: BotClient,
  policy: Policy,
  text: string,
  messageId: bigint
): Promise<Moderation> {
  console.log("Message text: ", text);

  const moderation = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: text,
  });
  if (moderation.results.length > 0) {
    const result = moderation.results[0];
    const breaking = categoriesThatBreakThreshold(
      policy.threshold,
      result.category_scores
    );
    if (breaking.length > 0) {
      return {
        kind: "moderated",
        messageId,
        scope: client.scope,
        reason: summariseViolations(breaking),
      };
    }
    return { kind: "not_moderated" };
  }
  return { kind: "not_moderated" };
}

export async function chatModerate(
  client: BotClient,
  text: string | undefined,
  contentHint: string,
  messageId: bigint,
  thread?: number
): Promise<Moderation> {
  // TODO - current limitation is that this does not account for the community rules (if they exist)
  const summary = await client.chatSummary();
  if (summary.kind === "group_chat" && summary.rules.enabled) {
    const result = await askOpenAI(
      summary.rules.text,
      text,
      contentHint,
      client.scope,
      messageId,
      thread
    );
    return result;
  }
  return Promise.resolve({ kind: "not_moderated" });
}

async function messageBreaksTheRules(
  client: BotClient,
  policy: Policy,
  moderated: Moderated,
  thread?: number
) {
  await saveModerationEvent(moderated);
  switch (policy.consequence.kind) {
    case "reaction":
      {
        const resp = await client
          .addReaction(moderated.messageId, policy.consequence.reaction, thread)
          .catch((err) => console.error("Error reacting to message", err));
        if (resp?.kind !== "success") {
          console.error("Error reacting to message: ", resp);
        }
      }
      break;
    case "deletion":
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
