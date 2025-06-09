import { BotClient, MessageContent } from "@open-ic/openchat-botclient-ts";
import OpenAI from "openai";
import { loadPolicy } from "./firebase";
import { Policy } from "./types";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const systemPrompt = `
You are a chat moderation assistant. Your job is to decide whether a message should be allowed, based on chat rules, the type of message (text, image, video, etc.), and the message context (either a top-level chat or a thread).

You will be provided with:
- Chat moderation rules
- The message type (text, image, video etc)
- The message context (whether it was posted directly in the main chat or inside a thread)
- The message content 

Follow this process:
1. Evaluate the message against the rules.
2. Decide whether it is allowed or should be blocked.
3. Provide a brief explanation.

Rules may include behavioural norms (e.g., "no abuse"), content-specific norms (e.g., "no media in chat"), or structural expectations (e.g., "discussions should happen in threads").

Be strict in applying rules that are easy to verify (like message type and message context). Be more lenient with ambiguous social norms unless there's clear evidence.

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
  thread?: number
): Promise<boolean> {
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
    if (!json.allowed) {
      console.log(json.reason);
    }
    return !json.allowed;
  }
  return false;
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
      let breaksChatRules = false;
      let breaksPlatformRules = false;
      if (policy.detection.kind !== "chat_rules" && txt !== undefined) {
        breaksPlatformRules = await platformModerate(policy, txt);
      }
      if (!breaksPlatformRules) {
        if (policy.detection.kind !== "platform_rules") {
          breaksChatRules = await chatModerate(client, txt, hint, thread);
        }
      }
      if (breaksPlatformRules) {
        console.log("Message broke platform rules: ", txt);
      }
      if (breaksChatRules) {
        console.log("Message broke chat rules: ", txt, hint);
      }
      if (breaksPlatformRules || breaksChatRules) {
        await messageBreaksTheRules(policy, client, messageId, thread);
      }
    }
  }
}

function anyCategoryBreaksThreshold(
  threshold: number,
  scores: OpenAI.Moderation.CategoryScores
): boolean {
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
  return scoreValues.some((v) => v >= threshold);
}

export async function platformModerate(
  policy: Policy,
  text: string
): Promise<boolean> {
  console.log("Message text: ", text);

  const moderation = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: text,
  });
  if (moderation.results.length > 0) {
    const result = moderation.results[0];
    const breaking = anyCategoryBreaksThreshold(
      policy.threshold,
      result.category_scores
    );
    if (breaking) {
      console.log("Moderation API result: ", result.category_scores);
    }
    return breaking;
  }
  return Promise.resolve(false);
}

export async function chatModerate(
  client: BotClient,
  text: string | undefined,
  contentHint: string,
  thread?: number
): Promise<boolean> {
  // TODO - current limitation is that this does not account for the community rules (if they exist)
  const summary = await client.chatSummary();
  if (summary.kind === "group_chat" && summary.rules.enabled) {
    const forbidden = await askOpenAI(
      summary.rules.text,
      text,
      contentHint,
      thread
    );
    return forbidden;
  }
  return Promise.resolve(false);
}

async function messageBreaksTheRules(
  policy: Policy,
  client: BotClient,
  messageId: bigint,
  thread?: number
) {
  switch (policy.consequence.kind) {
    case "reaction":
      {
        const resp = await client
          .addReaction(messageId, policy.consequence.reaction, thread)
          .catch((err) => console.error("Error reacting to message", err));
        if (resp?.kind !== "success") {
          console.error("Error reacting to message: ", resp);
        }
      }
      break;
    case "deletion":
      {
        const resp = await client
          .deleteMessages([messageId], thread)
          .catch((err) => console.error("Error deleting message", err));
        if (resp?.kind !== "success") {
          console.error("Error deleting message: ", resp);
        }
      }
      break;
  }
}
