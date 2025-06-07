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
  kind: z.literal("platform"),
});

const PlatformAndChatRulesSchema = z.object({
  kind: z.literal("platform_and_chat"),
});

const DetectionSchema = z.discriminatedUnion("kind", [
  PlatformRulesSchema,
  PlatformAndChatRulesSchema,
]);

export type DetectionMode = z.infer<typeof DetectionSchema>;

export const PolicySchema = z.object({
  moderating: z.boolean(),
  detection: DetectionSchema,
  consequence: ConsequenceSchema,
});

export type Policy = z.infer<typeof PolicySchema>;

export const defaultPolicy: Policy = {
  moderating: true,
  detection: { kind: "platform" },
  consequence: { kind: "reaction", reaction: "💩" },
};

// TODO - maybe we add something like a "temperature" param which we can apply to the platform rules so they can be
// toned down across the board (with some exceptions)
// And maybe we call them general rules or common sense rules rather than platform rules
