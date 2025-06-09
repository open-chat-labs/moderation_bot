import {
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

const ReactionSchema = z.object({
  kind: z.literal("reaction"),
  reaction: z.string(),
});

const DeletionSchema = z.object({
  kind: z.literal("deletion"),
});

const ConsequenceSchema = z.discriminatedUnion("kind", [
  ReactionSchema,
  DeletionSchema,
]);

export type ConsequenceMode = z.infer<typeof ConsequenceSchema>;

const PlatformRulesSchema = z.object({
  kind: z.literal("platform_rules"),
});

const ChatRulesSchema = z.object({
  kind: z.literal("chat_rules"),
});

const PlatformAndChatRulesSchema = z.object({
  kind: z.literal("platform_and_chat_rules"),
});

const DetectionSchema = z.discriminatedUnion("kind", [
  PlatformRulesSchema,
  PlatformAndChatRulesSchema,
  ChatRulesSchema,
]);

export type DetectionMode = z.infer<typeof DetectionSchema>;

export const PolicySchema = z.object({
  moderating: z.boolean(),
  detection: DetectionSchema,
  consequence: ConsequenceSchema,
  threshold: z.number(),
});

export type Policy = z.infer<typeof PolicySchema>;

export const defaultPolicy: Policy = {
  moderating: true,
  detection: { kind: "platform_rules" },
  consequence: { kind: "reaction", reaction: "💩" },
  threshold: 0.8,
};

// TODO - maybe we add something like a "temperature" param which we can apply to the platform rules so they can be
// toned down across the board (with some exceptions)
// And maybe we call them general rules or common sense rules rather than platform rules
