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

type AlreadyModerated = {
    kind: "already_moderated";
};

export type ModerationSource = "automated" | "user_report";

export type Moderated = {
    kind: "moderated";
    reason: string;
    scope: ActionScope;
    messageId: bigint;
    eventIndex: number;
    messageIndex: number;
    senderId: string;
    source: ModerationSource;
};

export type Moderation = Moderated | NotModerated | AlreadyModerated;

export enum Action {
    REACTION = 0,
    DELETION = 1,
}

export enum Explanation {
    NONE = 0,
    QUOTE_REPLY = 1,
    THREAD_REPLY = 2,
}

export type Policy = {
    moderating: boolean;
    action: Action;
    reaction?: string;
    threshold: number;
    explanation: Explanation;
};

export const defaultPolicy: Policy = {
    moderating: true,
    action: Action.REACTION,
    reaction: "💩",
    threshold: 0.8,
    explanation: Explanation.NONE,
};

export type MessageLocation = {
    messageIndex: number;
    threadIndex?: number;
};
