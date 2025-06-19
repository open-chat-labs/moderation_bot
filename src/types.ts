import {
  ActionScope,
  ImageContent,
  InstallationRegistry,
  MessageEvent,
  TextContent,
} from "@open-ic/openchat-botclient-ts";

export type ModeratableContent =
  | MessageEvent<TextContent>
  | MessageEvent<ImageContent>;

export type State = {
  installs: InstallationRegistry;
};

type NotModerated = {
  kind: "not_moderated";
};

export type Moderated = {
  kind: "moderated";
  reason: string;
  scope: ActionScope;
  messageId: bigint;
  eventIndex: number;
  messageIndex: number;
  senderId: string;
};

export type Moderation = Moderated | NotModerated;

export enum Action {
  REACTION = 0,
  DELETION = 1,
}

export enum Explanation {
  NONE = 0,
  QUOTE_REPLY = 1,
  THREAD_REPLY = 2,
}

export enum Rules {
  GENERAL_RULES = 0,
  CHAT_RULES = 1,
  GENERAL_AND_CHAT_RULES = 2,
}

export type Policy = {
  moderating: boolean;
  rules: Rules;
  action: Action;
  reaction?: string;
  threshold: number;
  explanation: Explanation;
};

export const defaultPolicy: Policy = {
  moderating: true,
  rules: Rules.GENERAL_RULES,
  action: Action.REACTION,
  reaction: "💩",
  threshold: 0.8,
  explanation: Explanation.NONE,
};

export type CategoryViolation = {
  category: string;
  score: number;
};
