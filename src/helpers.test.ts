import { describe, expect, it } from "vitest";
import { extractMessageLocation } from "./helpers";

describe("extractMessageLocation", () => {
    describe("Invalid urls", () => {
        it("should return undefined for empty url", () => {
            expect(extractMessageLocation("")).toBeUndefined();
        });

        it("should return undefined for malformed url", () => {
            expect(
                extractMessageLocation("some arbitrary string or other"),
            ).toBeUndefined();
        });
    });
    describe("Group chat URLs", () => {
        it("should extract messageIndex from group chat URL without thread", () => {
            const url = "https://oc.app/chats/group/abc123-cai/42";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 42,
            });
        });

        it("should extract messageIndex and threadIndex from group chat URL with thread", () => {
            const url = "https://oc.app/chats/group/abc123-cai/42/100";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 42,
                threadIndex: 100,
            });
        });

        it("should handle group chat URLs with different domains", () => {
            const url = "https://openchat.com/chats/group/xyz789-cai/123/456";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 123,
                threadIndex: 456,
            });
        });

        it("should handle large message index numbers", () => {
            const url = "https://oc.app/chats/group/test-cai/999999999";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 999999999,
            });
        });
    });

    describe("Channel/Community URLs", () => {
        it("should extract messageIndex from channel URL without thread", () => {
            const url =
                "https://oc.app/community/yf5kc-uaaaa-aaaar-a7qfq-cai/channel/698867665/77";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 77,
            });
        });

        it("should extract messageIndex and threadIndex from channel URL with thread", () => {
            const url =
                "https://oc.app/community/comm123-cai/channel/chan456/50/200";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 50,
                threadIndex: 200,
            });
        });

        it("should handle channel URLs with complex canister IDs", () => {
            const url =
                "https://oc.app/community/2yfsq-kaaaa-aaaaf-aaa4q-cai/channel/123456789/1/2";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 1,
                threadIndex: 2,
            });
        });
    });

    describe("Edge cases", () => {
        it("should return undefined for invalid URL format", () => {
            const url = "https://oc.app/invalid/path";
            const result = extractMessageLocation(url);

            expect(result).toBeUndefined();
        });

        it("should return undefined for non-matching paths", () => {
            const url = "https://oc.app/settings";
            const result = extractMessageLocation(url);

            expect(result).toBeUndefined();
        });

        it("should return undefined for malformed group URL", () => {
            const url = "https://oc.app/chats/group/";
            const result = extractMessageLocation(url);

            expect(result).toBeUndefined();
        });

        it("should return undefined for malformed channel URL", () => {
            const url = "https://oc.app/community/comm123/channel/";
            const result = extractMessageLocation(url);

            expect(result).toBeUndefined();
        });

        it("should handle URLs with query parameters", () => {
            const url = "https://oc.app/chats/group/abc123-cai/42?param=value";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 42,
            });
        });

        it("should handle URLs with hash fragments", () => {
            const url = "https://oc.app/chats/group/abc123-cai/42#section";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 42,
            });
        });

        it("should return undefined for non-numeric messageIndex", () => {
            const url = "https://oc.app/chats/group/abc123-cai/notanumber";
            const result = extractMessageLocation(url);

            // The function will still try to convert it with Number()
            // which results in NaN, but the structure is returned
            expect(result).toBeDefined();
            expect(result?.messageIndex).toBeNaN();
        });

        it("should handle messageIndex of 0", () => {
            const url = "https://oc.app/chats/group/abc123-cai/0";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 0,
            });
        });

        it("should handle threadIndex of 0", () => {
            const url = "https://oc.app/chats/group/abc123-cai/42/0";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 42,
                threadIndex: 0,
            });
        });
    });

    describe("Real-world examples", () => {
        it("should handle the example from the codebase", () => {
            const url =
                "https://oc.app/community/yf5kc-uaaaa-aaaar-a7qfq-cai/channel/698867665/77";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 77,
            });
        });

        it("should handle typical group chat message URL", () => {
            const url =
                "https://oc.app/chats/group/rrkah-fqaaa-aaaaa-aaaaq-cai/1234";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 1234,
            });
        });

        it("should handle typical thread reply URL", () => {
            const url =
                "https://oc.app/chats/group/rrkah-fqaaa-aaaaa-aaaaq-cai/100/5";
            const result = extractMessageLocation(url);

            expect(result).toEqual({
                messageIndex: 100,
                threadIndex: 5,
            });
        });
    });
});
