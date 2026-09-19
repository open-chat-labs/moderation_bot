import { describe, expect, it } from "vitest";
import { describeBroken, Rule, splitRules, verdict } from "./rules";

describe("splitRules", () => {
    /** Invariant 11: each non-blank rule line becomes exactly one rule, in order, none dropped or merged */
    it("invariant 11: one rule per non-blank line, order and source kept", () => {
        const community = "1. Be kind\n\n2) No spam\n";
        const channel =
            "- No promo links\n* English only\r\n• Media only in threads\nplain rule";
        expect(
            splitRules([
                { source: "community", text: community },
                { source: "channel", text: channel },
            ]),
        ).toEqual([
            { source: "community", text: "Be kind" },
            { source: "community", text: "No spam" },
            { source: "channel", text: "No promo links" },
            { source: "channel", text: "English only" },
            { source: "channel", text: "Media only in threads" },
            { source: "channel", text: "plain rule" },
        ]);
    });

    it("invariant 11: long paragraph lines are not split or merged", () => {
        const text =
            "Keep it civil. No insults, no slurs.\nThe above applies to threads too.";
        expect(splitRules([{ source: "group", text }])).toEqual([
            { source: "group", text: "Keep it civil. No insults, no slurs." },
            { source: "group", text: "The above applies to threads too." },
        ]);
    });

    it("returns nothing for blank texts", () => {
        expect(
            splitRules([
                { source: "community", text: "" },
                { source: "channel", text: "  \n\n " },
            ]),
        ).toEqual([]);
    });
});

describe("verdict", () => {
    const rules: Rule[] = [
        { source: "community", text: "Be kind" },
        { source: "channel", text: "No spam" },
        { source: "channel", text: "No promo links" },
    ];

    /** Invariant 9: flagged iff at least one rule's probability is at or above the threshold */
    it("invariant 9: a score equal to the threshold flags", () => {
        expect(verdict(rules, [0.1, 0.8, 0.2], 0.8)).toEqual({
            kind: "flagged",
            broken: [{ rule: rules[1], score: 0.8 }],
        });
    });

    it("invariant 9: every score below the threshold does not flag", () => {
        expect(verdict(rules, [0.79, 0.5, 0], 0.8)).toEqual({
            kind: "not_flagged",
        });
    });

    /** Invariant 10: the reason names every rule that crossed the threshold, with its probability */
    it("invariant 10: lists every broken rule with its source and score", () => {
        const result = verdict(rules, [0.91, 0.3, 0.856], 0.8);
        expect(result.kind).toBe("flagged");
        if (result.kind !== "flagged") return;
        expect(describeBroken(result.broken)).toBe(
            'It looks like this message broke the community rule "Be kind" (0.91 confidence) and the channel rule "No promo links" (0.86 confidence)',
        );
    });

    it("invariant 10: three broken rules read as a list, trailing full stops dropped", () => {
        const result = verdict(
            [...rules.slice(0, 2), { source: "channel", text: "No dogs." }],
            [0.9, 0.9, 0.9],
            0.8,
        );
        if (result.kind !== "flagged") throw new Error("expected flagged");
        expect(describeBroken(result.broken)).toBe(
            'It looks like this message broke the community rule "Be kind" (0.90 confidence), the channel rule "No spam" (0.90 confidence) and the channel rule "No dogs" (0.90 confidence)',
        );
    });
});
