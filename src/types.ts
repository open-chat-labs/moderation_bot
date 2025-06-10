import {
  ActionScope,
  ImageContent,
  InstallationRegistry,
  MessageEvent,
  TextContent,
} from "@open-ic/openchat-botclient-ts";
import { z } from "zod";

export type ModeratableContent =
  | MessageEvent<TextContent>
  | MessageEvent<ImageContent>;

export type State = {
  installs: InstallationRegistry;
};

const NotModeratedSchema = z.object({
  kind: z.literal("not_moderated"),
});

const ModeratedSchema = z.object({
  kind: z.literal("moderated"),
  reason: z.string(),
  scope: z.custom<ActionScope>(),
  messageId: z.bigint(),
});

const ModerationSchema = z.discriminatedUnion("kind", [
  NotModeratedSchema,
  ModeratedSchema,
]);

export type Moderation = z.infer<typeof ModerationSchema>;
export type Moderated = z.infer<typeof ModeratedSchema>;

const ReactionSchema = z.object({
  kind: z.literal("reaction"),
  reaction: z.string(),
});

const DeletionSchema = z.object({
  kind: z.literal("deletion"),
});

const ActionSchema = z.discriminatedUnion("kind", [
  ReactionSchema,
  DeletionSchema,
]);

export type ActionMode = z.infer<typeof ActionSchema>;

const GeneralRulesSchema = z.object({
  kind: z.literal("general_rules"),
});

const ChatRulesSchema = z.object({
  kind: z.literal("chat_rules"),
});

const ExplanationSchema = z.enum(["none", "quote_reply", "thread_reply"]);
export type Explanation = z.infer<typeof ExplanationSchema>;

const GeneralAndChatRulesSchema = z.object({
  kind: z.literal("general_and_chat_rules"),
});

const RulesSchema = z.discriminatedUnion("kind", [
  GeneralRulesSchema,
  GeneralAndChatRulesSchema,
  ChatRulesSchema,
]);

export type RulesMode = z.infer<typeof RulesSchema>;

export const PolicySchema = z.object({
  moderating: z.boolean(),
  rules: RulesSchema,
  action: ActionSchema,
  threshold: z.number(),
  explanation: ExplanationSchema,
});

export type Policy = z.infer<typeof PolicySchema>;

export const defaultPolicy: Policy = {
  moderating: true,
  rules: { kind: "general_rules" },
  action: { kind: "reaction", reaction: "💩" },
  threshold: 0.8,
  explanation: "none",
};

export type CategoryViolation = {
  category: string;
  score: number;
};
