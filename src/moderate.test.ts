import { MessageEvent } from "@open-ic/openchat-botclient-ts";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getPolicy,
    hasBeenModerated,
    saveModerationEvent,
} from "./db/database";
import { JEV_MODEL, JEV_URL } from "./jev";
import { moderateMessage } from "./moderate";
import { Action, defaultPolicy, Explanation } from "./types";

vi.mock("./db/database", () => ({
    getPolicy: vi.fn(),
    hasBeenModerated: vi.fn(),
    saveModerationEvent: vi.fn(),
}));

const API_KEY = "ts-secret-key-do-not-leak";
const BOT_ID = "the-bot";
const MESSAGE_TEXT = "Buy my coin at scam.example now";

type FakeChat = {
    kind?: "group_chat" | "direct_chat";
    isPublic?: boolean;
    rules?: string;
};

function fakeMessage() {
    const msg: Record<string, unknown> = {};
    msg.setRepliesTo = () => msg;
    msg.setThread = () => msg;
    msg.setFinalised = () => Promise.resolve(msg);
    return msg;
}

function fakeClient(chat: FakeChat = {}) {
    const { kind = "group_chat", isPublic = true, rules = "No promo links" } =
        chat;
    return {
        scope: { isChatScope: () => true, chat: { isChannel: () => false } },
        chatSummary: vi.fn(async () =>
            kind === "direct_chat"
                ? { kind }
                : {
                      kind,
                      isPublic,
                      rules: { enabled: rules !== "", text: rules },
                  },
        ),
        communitySummary: vi.fn(),
        addReaction: vi.fn(async () => ({ kind: "success" })),
        deleteMessages: vi.fn(async () => ({ kind: "success" })),
        createTextMessage: vi.fn(async (_: string) => fakeMessage()),
        sendMessage: vi.fn(async () => ({ kind: "success" })),
    };
}

type Client = ReturnType<typeof fakeClient>;

function message(sender = "someone", text = MESSAGE_TEXT): MessageEvent {
    return {
        messageId: 42n,
        messageIndex: 7,
        sender,
        content: { kind: "text_content", text },
    } as unknown as MessageEvent;
}

function jevResponse(scores: number[]) {
    const answers: Record<string, unknown> = {};
    scores.forEach((s, i) => (answers[`rule_${i}`] = { type: "noul", noul: s }));
    return new Response(JSON.stringify({ model: "jev-1.13.0", answers }), {
        status: 200,
    });
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(impl: () => Promise<Response>) {
    fetchMock = vi.fn(impl);
    vi.stubGlobal("fetch", fetchMock);
}

function run(client: Client, event = message(), manual = false, thread?: number) {
    return moderateMessage(
        client as never,
        3,
        event,
        thread,
        manual,
    );
}

function expectNoAction(client: Client) {
    expect(client.addReaction).not.toHaveBeenCalled();
    expect(client.deleteMessages).not.toHaveBeenCalled();
    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(saveModerationEvent).not.toHaveBeenCalled();
}

function requestBody(call = 0) {
    return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
    process.env.BOT_ID = BOT_ID;
    process.env.TYPESAFE_API_KEY = API_KEY;
    vi.mocked(getPolicy).mockResolvedValue({
        ...defaultPolicy,
        explanation: Explanation.QUOTE_REPLY,
    });
    vi.mocked(hasBeenModerated).mockResolvedValue(false);
    vi.mocked(saveModerationEvent).mockResolvedValue(undefined);
    stubFetch(async () => jevResponse([0.95]));
});

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("moderateMessage", () => {
    it("flags a message that breaks a rule and reacts", async () => {
        const client = fakeClient();
        const result = await run(client);
        expect(result.kind).toBe("moderated");
        expect(client.addReaction).toHaveBeenCalledWith(42n, "💩", undefined);
        expect(saveModerationEvent).toHaveBeenCalledOnce();
    });

    it("deletes when the policy says so", async () => {
        vi.mocked(getPolicy).mockResolvedValue({
            ...defaultPolicy,
            action: Action.DELETION,
        });
        const client = fakeClient();
        await run(client);
        expect(client.deleteMessages).toHaveBeenCalledWith([42n], undefined);
        expect(client.addReaction).not.toHaveBeenCalled();
    });

    /** Invariant 1: a message from a chat that isn't public is never sent to TypeSafe */
    it.each([
        ["private group", { isPublic: false }],
        ["direct chat", { kind: "direct_chat" as const }],
    ])("invariant 1: %s sends nothing to TypeSafe", async (_, chat) => {
        const client = fakeClient(chat);
        await run(client);
        await run(client, message(), true);
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoAction(client);
    });

    /** Invariant 2: paused, an incoming message sends nothing to TypeSafe, but /report still does */
    it("invariant 2: paused sends nothing for incoming messages", async () => {
        vi.mocked(getPolicy).mockResolvedValue({
            ...defaultPolicy,
            moderating: false,
        });
        const client = fakeClient();
        await run(client);
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoAction(client);
    });

    it("invariant 2: paused still checks a /report", async () => {
        vi.mocked(getPolicy).mockResolvedValue({
            ...defaultPolicy,
            moderating: false,
        });
        const client = fakeClient();
        const result = await run(client, message(), true);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(result.kind).toBe("moderated");
    });

    /** Invariant 3: a message sent by the bot is never sent to TypeSafe */
    it("invariant 3: the bot's own messages are skipped", async () => {
        const client = fakeClient();
        await run(client, message(BOT_ID));
        await run(client, message(BOT_ID), true);
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoAction(client);
    });

    /** Invariant 4: an already moderated message is never sent again and never gets a second action */
    it("invariant 4: already moderated messages are skipped", async () => {
        vi.mocked(hasBeenModerated).mockResolvedValue(true);
        const client = fakeClient();
        const auto = await run(client);
        const report = await run(client, message(), true);
        expect(auto.kind).toBe("already_moderated");
        expect(report.kind).toBe("already_moderated");
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoAction(client);
    });

    /** Invariant 5: a chat with no enabled rules text sends nothing to TypeSafe */
    it.each([
        ["rules disabled", ""],
        ["only blank lines", "  \n\n  "],
    ])("invariant 5: %s sends nothing", async (_, rules) => {
        const client = fakeClient({ rules });
        await run(client);
        await run(client, message(), true);
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoAction(client);
    });

    /** Invariant 6: message content appears only in the request state, never in question instructions */
    it("invariant 6: message content only goes in the state", async () => {
        const client = fakeClient({ rules: "No promo links\nBe kind" });
        stubFetch(async () => jevResponse([0.1, 0.1]));
        await run(client, message(), false, 12);
        const body = requestBody();
        expect(body.state).toEqual({
            type: "Text message",
            context: "thread",
            content: MESSAGE_TEXT,
        });
        const questions = Object.values(body.questions) as {
            instructions: string;
        }[];
        expect(questions).toHaveLength(2);
        for (const q of questions) {
            expect(q.instructions).not.toContain(MESSAGE_TEXT);
        }
    });

    /** Invariant 7: every TypeSafe request names model jev-latest */
    it("invariant 7: requests name jev-latest", async () => {
        await run(fakeClient());
        await run(fakeClient(), message(), true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JEV_MODEL).toBe("jev-latest");
        expect(requestBody(0).model).toBe("jev-latest");
        expect(requestBody(1).model).toBe("jev-latest");
    });

    const failures: [string, () => Promise<Response>][] = [
        ["network error", async () => { throw new TypeError("fetch failed"); }],
        ["timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
        ["500", async () => new Response("oops", { status: 500 })],
        ["529", async () => new Response("overloaded", { status: 529 })],
        ["429", async () => new Response("slow down", { status: 429 })],
        ["missing answer", async () => new Response(JSON.stringify({ model: "jev-1.13.0", answers: {} }), { status: 200 })],
        ["non-JSON body", async () => new Response("not json", { status: 200 })],
    ];

    /** Invariant 8: a TypeSafe failure causes no reaction, deletion, explanation or moderation event */
    it.each(failures)("invariant 8: %s takes no action", async (_, impl) => {
        stubFetch(impl);
        const client = fakeClient();
        const result = await run(client);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(result.kind).toBe("not_moderated");
        expectNoAction(client);
    });

    /** Invariant 10: every moderation event names each rule that crossed the threshold, with its probability */
    it("invariant 10: the saved event names each broken rule and score", async () => {
        const client = fakeClient({
            rules: "1. Be kind\n2. No spam\n3. No promo links",
        });
        stubFetch(async () => jevResponse([0.9, 0.1, 0.85]));
        await run(client);
        expect(saveModerationEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                reason: 'It looks like this message broke the group rule "Be kind" (0.90 confidence) and the group rule "No promo links" (0.85 confidence)',
            }),
        );
        expect(client.createTextMessage).toHaveBeenCalledWith(
            'It looks like this message broke the group rule "Be kind" (0.90 confidence) and the group rule "No promo links" (0.85 confidence)',
        );
    });

    it("in a channel, checks community then channel rules and names the source", async () => {
        const client = {
            ...fakeClient({ rules: "No promo links" }),
            scope: {
                isChatScope: () => true,
                chat: { isChannel: () => true, communityId: "community-id" },
            },
            communitySummary: vi.fn(async () => ({
                kind: "community_summary",
                rules: { enabled: true, text: "do not talk about dogs." },
            })),
        };
        stubFetch(async () => jevResponse([0.96, 0.1]));
        await run(client as unknown as Client);
        const instructions = Object.values(requestBody().questions).map(
            (q) => (q as { instructions: string }).instructions,
        );
        expect(instructions[0]).toContain("do not talk about dogs.");
        expect(instructions[1]).toContain("No promo links");
        expect(saveModerationEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                reason: 'It looks like this message broke the community rule "do not talk about dogs" (0.96 confidence)',
            }),
        );
    });

    /** Invariant 12: the bot never sends a request to OpenAI */
    it("invariant 12: only TypeSafe is called and openai is not a dependency", async () => {
        await run(fakeClient());
        await run(fakeClient(), message(), true);
        for (const [url] of fetchMock.mock.calls) {
            expect(url).toBe(JEV_URL);
        }
        const pkg = JSON.parse(
            readFileSync(new URL("../package.json", import.meta.url), "utf8"),
        );
        expect(Object.keys(pkg.dependencies)).not.toContain("openai");
    });

    /** Invariant 13: the TypeSafe API key never appears in a chat message or a log line */
    it.each([
        ["success", async () => jevResponse([0.95])] as [string, () => Promise<Response>],
        ...failures,
    ])("invariant 13: key never logged or sent to chat (%s)", async (_, impl) => {
        stubFetch(impl);
        const logged: unknown[] = [];
        for (const level of ["log", "error", "warn", "info", "debug"] as const) {
            vi.spyOn(console, level).mockImplementation((...args) => {
                logged.push(...args);
            });
        }
        const client = fakeClient();
        await run(client);

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);

        const text = (x: unknown) =>
            x instanceof Error ? `${x.message} ${x.stack}` : JSON.stringify(x, (_, v) => typeof v === "bigint" ? v.toString() : v) ?? String(x);
        for (const entry of logged) {
            expect(text(entry)).not.toContain(API_KEY);
        }
        for (const [msg] of client.createTextMessage.mock.calls) {
            expect(msg).not.toContain(API_KEY);
        }
    });
});
